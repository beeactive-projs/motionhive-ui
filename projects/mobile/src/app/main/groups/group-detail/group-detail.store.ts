import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, take, tap } from 'rxjs';

import {
  GroupMember,
  GroupService,
  GroupWithMyRole,
  GroupsRefreshService,
  Post,
  PostService,
} from 'core';

import { ViewerRole } from '../groups.config';
import { GroupTab, GroupTabs, matchesMemberQuery } from '../groups.filters';

const PAGE_SIZE = 20;

/**
 * How long an unforced re-entry leaves what is on screen alone. Same window
 * and reasoning as the hub: the param subscription loads on open and
 * `ionViewWillEnter` fires immediately after, so without this every open
 * costs two identical round trips.
 */
const FRESH_MS = 15_000;

/** `done` fires on every exit so a refresher spinner can never hang. */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * One group: its posts, its members, and who the viewer is inside it.
 *
 * The viewer's role comes from the server on the group itself. Deriving it
 * by searching the member list — which is what the web app does — is wrong:
 * that list is paginated at 20 and ordered by join date, so a moderator who
 * joined late reads as a non-member and silently loses their controls.
 */
@Injectable()
export class GroupDetailStore {
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _groupId = '';
  private _fetchedAt = 0;

  constructor() {
    // A write elsewhere — composing a post, joining, leaving — makes what we
    // hold wrong no matter how recently it was fetched. Dropping the
    // timestamp lets the next `reenter()` through the freshness window
    // instead of showing a feed that is missing the post just written.
    this._groupsRefresh.refresh$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._fetchedAt = 0;
      });
  }

  readonly tab = signal<GroupTab>(GroupTabs.Posts);

  /** Narrows the loaded member rows. Members only. */
  readonly memberQuery = signal('');

  private readonly _group = signal<GroupWithMyRole | null>(null);
  private readonly _groupLoading = signal(false);
  private readonly _groupError = signal(false);

  private readonly _posts = signal<Post[]>([]);
  private readonly _postsTotal = signal(0);
  private readonly _postsPage = signal(1);
  private readonly _postsLoading = signal(false);
  private readonly _postsError = signal(false);
  private readonly _postsLoaded = signal(false);

  private readonly _members = signal<GroupMember[]>([]);
  private readonly _membersTotal = signal(0);
  private readonly _membersPage = signal(1);
  private readonly _membersLoading = signal(false);
  private readonly _membersError = signal(false);
  private readonly _membersLoaded = signal(false);

  readonly group = this._group.asReadonly();
  readonly posts = this._posts.asReadonly();
  readonly members = this._members.asReadonly();
  readonly membersTotal = this._membersTotal.asReadonly();

  /**
   * Authoritative, straight off the group. `null` only before the group has
   * loaded — a non-member never gets this far, since the API 403s the read.
   */
  readonly viewerRole = computed<ViewerRole>(() => this._group()?.myRole ?? null);

  readonly postsHasMore = computed(() => this._posts().length < this._postsTotal());
  readonly membersHasMore = computed(() => this._members().length < this._membersTotal());

  readonly visibleMembers = computed(() => {
    const term = this.memberQuery();
    const rows = this._members();
    return term ? rows.filter((member) => matchesMemberQuery(member, term)) : rows;
  });

  private readonly _isPosts = computed(() => this.tab() === GroupTabs.Posts);
  private readonly _isMembers = computed(() => this.tab() === GroupTabs.Members);

  /** The group itself is still coming; the whole screen is a skeleton. */
  readonly showGroupSkeleton = computed(() => this._groupLoading() && !this._group());

  readonly showGroupError = computed(() => this._groupError() && !this._group());

  /** First load of the tab on screen, with nothing under it yet. */
  readonly showSkeleton = computed(() => {
    if (this._isPosts()) return this._postsLoading() && this._posts().length === 0;
    if (this._isMembers()) return this._membersLoading() && this._members().length === 0;
    return false;
  });

  readonly showLoadError = computed(() => {
    if (this._isPosts()) return this._postsError() && this._posts().length === 0;
    if (this._isMembers()) return this._membersError() && this._members().length === 0;
    return false;
  });

  /**
   * The last load failed but older rows are still under it. Keeping them is
   * right; letting them pass for current is not, so the page says so inline
   * with a retry rather than raising a toast that is gone before it is read.
   */
  readonly isStale = computed(() => {
    if (this._isPosts()) return this._postsError() && this._posts().length > 0;
    if (this._isMembers()) return this._membersError() && this._members().length > 0;
    return false;
  });

  readonly isEmpty = computed(() => {
    if (this._isPosts()) return this._postsLoaded() && this._posts().length === 0;
    if (this._isMembers()) return this._membersLoaded() && this._members().length === 0;
    return false;
  });

  /** A member search hid everyone, but the group is not empty. */
  readonly isFilteredEmpty = computed(
    () => this._isMembers() && !!this.memberQuery().trim() && this.visibleMembers().length === 0,
  );

  /** Called once by the page with the id from the route. */
  init(groupId: string): void {
    if (groupId === this._groupId) return;
    this._groupId = groupId;
    this._resetAll();
    this._fetchedAt = Date.now();
    this.load();
  }

  /** Loads the group, plus whichever tab is on screen. */
  load(opts: LoadOptions = {}): void {
    this._loadGroup(opts.force);
    if (this._isPosts()) {
      this.loadPosts(opts);
      return;
    }
    if (this._isMembers()) {
      this.loadMembers(opts);
      return;
    }
    // About renders from the group alone; nothing else to fetch.
    opts.done?.();
  }

  refresh(done?: (error?: unknown) => void): void {
    this._fetchedAt = Date.now();
    this.load({ force: true, done });
  }

  /**
   * Entering the page. Ionic keeps it alive in the stack, so a post added or
   * a member removed elsewhere still has to be picked up — but anything
   * younger than `FRESH_MS` is left alone, which is what stops the open
   * itself from fetching twice.
   */
  reenter(): void {
    if (this._fetchedAt > 0 && Date.now() - this._fetchedAt < FRESH_MS) return;
    this.refresh();
  }

  setTab(tab: GroupTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    // Fills a gap an earlier error left, or a first visit to this tab.
    this.load();
  }

  setMemberQuery(value: string): void {
    this.memberQuery.set(value);
  }

  loadPosts(opts: LoadOptions = {}): void {
    if (!opts.force && (this._postsLoading() || this._postsLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchPosts(1, opts.done);
  }

  loadMorePosts(done?: (error?: unknown) => void): void {
    if (this._postsLoading() || !this.postsHasMore()) {
      done?.();
      return;
    }
    this._fetchPosts(this._postsPage() + 1, done);
  }

  loadMembers(opts: LoadOptions = {}): void {
    if (!opts.force && (this._membersLoading() || this._membersLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchMembers(1, opts.done);
  }

  loadMoreMembers(done?: (error?: unknown) => void): void {
    if (this._membersLoading() || !this.membersHasMore()) {
      done?.();
      return;
    }
    this._fetchMembers(this._membersPage() + 1, done);
  }

  // ── Verbs ──────────────────────────────────────────────────────────────
  // These return the observable so the page can toast and close its sheet on
  // the real outcome. Each is already cancelled with the page, since the
  // store is provided there.

  /**
   * Like or unlike. The count comes back from the server rather than being
   * incremented locally: two devices on the same post would otherwise drift,
   * and the response is authoritative.
   */
  toggleReaction(post: Post): Observable<{ reacted: boolean; count: number }> {
    return this._postService.toggleReaction(post.id).pipe(
      take(1),
      tap((result) => {
        this._posts.update((list) =>
          list.map((row) =>
            row.id === post.id
              ? {
                  ...row,
                  reactionCount: result.count,
                  myReaction: result.reacted ? 'LIKE' : null,
                }
              : row,
          ),
        );
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  deletePost(postId: string): Observable<unknown> {
    return this._postService.deletePost(postId).pipe(
      take(1),
      tap(() => {
        this._posts.update((list) => list.filter((row) => row.id !== postId));
        this._postsTotal.update((total) => Math.max(0, total - 1));
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  /**
   * After composing. The new post is not spliced in from the create
   * response: under APPROVAL_REQUIRED it would not be visible to anyone yet,
   * so showing it in the feed would misreport what happened.
   */
  reloadPosts(): void {
    this._postsLoaded.set(false);
    this.loadPosts({ force: true });
  }

  removeMember(userId: string): Observable<unknown> {
    return this._groupService.removeMember(this._groupId, userId).pipe(
      take(1),
      tap(() => {
        this._members.update((list) => list.filter((row) => row.userId !== userId));
        this._membersTotal.update((total) => Math.max(0, total - 1));
        this._bumpMemberCount(-1);
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  updateMemberRole(userId: string, role: 'MEMBER' | 'MODERATOR'): Observable<GroupMember> {
    return this._groupService.updateMemberRole(this._groupId, userId, { role }).pipe(
      take(1),
      tap((updated) => {
        this._members.update((list) =>
          list.map((row) => (row.userId === userId ? { ...row, role: updated.role } : row)),
        );
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  leave(): Observable<unknown> {
    return this._groupService
      .leaveGroup(this._groupId)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef));
  }

  // ── Fetching ───────────────────────────────────────────────────────────

  private _loadGroup(force = false): void {
    if (!force && (this._groupLoading() || this._group())) return;
    this._groupLoading.set(true);
    this._groupError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._groupService
      .getById(this._groupId)
      .pipe(
        take(1),
        finalize(() => this._groupLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (group) => this._group.set(group),
        error: () => this._groupError.set(true),
      });
  }

  private _fetchPosts(page: number, done?: (error?: unknown) => void): void {
    this._postsLoading.set(true);
    this._postsError.set(false);

    this._postService
      .getGroupFeed(this._groupId, page, PAGE_SIZE)
      .pipe(
        take(1),
        finalize(() => this._postsLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (response) => {
          this._posts.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._postsTotal.set(response.total);
          this._postsPage.set(page);
          this._postsLoaded.set(true);
          done?.();
        },
        error: (error: unknown) => {
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._postsError.set(true);
          done?.(error);
        },
      });
  }

  private _fetchMembers(page: number, done?: (error?: unknown) => void): void {
    this._membersLoading.set(true);
    this._membersError.set(false);

    this._groupService
      .getMembers(this._groupId, page, PAGE_SIZE)
      .pipe(
        take(1),
        finalize(() => this._membersLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (response) => {
          this._members.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._membersTotal.set(response.total);
          this._membersPage.set(page);
          this._membersLoaded.set(true);
          done?.();
        },
        error: (error: unknown) => {
          if (page === 1) this._membersError.set(true);
          done?.(error);
        },
      });
  }

  /** Keeps the header's count honest after a removal. */
  private _bumpMemberCount(delta: number): void {
    this._group.update((group) =>
      group ? { ...group, memberCount: Math.max(0, group.memberCount + delta) } : group,
    );
  }

  private _resetAll(): void {
    this._group.set(null);
    this._groupError.set(false);
    this._posts.set([]);
    this._postsTotal.set(0);
    this._postsPage.set(1);
    this._postsLoaded.set(false);
    this._postsError.set(false);
    this._members.set([]);
    this._membersTotal.set(0);
    this._membersPage.set(1);
    this._membersLoaded.set(false);
    this._membersError.set(false);
    this.memberQuery.set('');
    this.tab.set(GroupTabs.Posts);
  }
}
