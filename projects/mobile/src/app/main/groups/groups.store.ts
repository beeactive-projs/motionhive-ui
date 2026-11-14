import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, take, tap } from 'rxjs';

import {
  GroupService,
  GroupWithMyRole,
  GroupsRefreshService,
  PendingGroupInvitation,
  Post,
  PostService,
} from 'core';

import { isOwner, waitingCount } from './groups.config';
import { GroupsSegment, GroupsSegments } from './groups.filters';

const PAGE_SIZE = 20;

/**
 * How long an unforced re-entry leaves what is on screen alone. Same window
 * and same reasoning as the Clients tab: stepping into a group and straight
 * back out re-fired the lists for data seconds old.
 */
const FRESH_MS = 15_000;

/** `done` fires on every exit so a refresher spinner can never hang. */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for Groups home: the Feed (every post from every group
 * you are in) and Your groups (the groups you run, then the ones you
 * joined), plus the invitations waiting on you, which sit on top of both.
 *
 * Finding a group lives in the Discover tab, not here (design 2026-11-14).
 *
 * Your groups loads with the Feed too: the Feed's "Needs you" card and its
 * empty state both read it, and each post's ⋯ needs your role in its group.
 */
@Injectable()
export class GroupsStore {
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // Joining, leaving or creating a group changes both lists. The
    // timestamps go so the next `reenter()` actually refetches rather than
    // deciding the seconds-old data it already has is still good.
    this._groupsRefresh.refresh$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
      this._feedFetchedAt = 0;
      this._mineFetchedAt = 0;
      this._feedLoaded.set(false);
      this._mineLoaded.set(false);
    });
  }

  readonly segment = signal<GroupsSegment>(GroupsSegments.Feed);

  // ── Feed ───────────────────────────────────────────────────────────────
  private readonly _feed = signal<Post[]>([]);
  private readonly _feedTotal = signal(0);
  private readonly _feedPage = signal(1);
  private readonly _feedLoading = signal(false);
  private readonly _feedError = signal(false);
  private readonly _feedLoaded = signal(false);
  private _feedFetchedAt = 0;

  // ── Your groups ────────────────────────────────────────────────────────
  private readonly _mine = signal<GroupWithMyRole[]>([]);
  private readonly _mineLoading = signal(false);
  private readonly _mineError = signal(false);
  private readonly _mineLoaded = signal(false);
  private _mineFetchedAt = 0;

  // ── Invitations ────────────────────────────────────────────────────────
  private readonly _invitations = signal<PendingGroupInvitation[]>([]);

  readonly feed = this._feed.asReadonly();
  readonly mine = this._mine.asReadonly();
  readonly invitations = this._invitations.asReadonly();

  readonly feedHasMore = computed(() => this._feed().length < this._feedTotal());

  /** How many groups the viewer belongs to. Drives the feed's empty state. */
  readonly myGroupCount = computed(() => this._mine().length);

  /** Most recent sign of life first, then by name, so a busy group leads. */
  private readonly _sorted = computed(() =>
    [...this._mine()].sort((a, b) => {
      const byPost = (b.lastPostAt ?? '').localeCompare(a.lastPostAt ?? '');
      if (byPost !== 0) {
        return byPost;
      }
      return a.name.localeCompare(b.name);
    }),
  );

  /** The groups you run (owner). */
  readonly run = computed(() => this._sorted().filter((group) => isOwner(group.myRole)));

  /** The groups you joined, moderated ones included. */
  readonly joined = computed(() => this._sorted().filter((group) => !isOwner(group.myRole)));

  /** Groups with join requests or posts waiting on you: the feed's "Needs you". */
  readonly needsYou = computed(() => this._sorted().filter((group) => waitingCount(group) > 0));

  /** Your role in each group, for the ⋯ on a feed post. */
  readonly roleByGroup = computed(
    () => new Map(this._mine().map((group) => [group.id, group.myRole])),
  );

  private readonly _isFeed = computed(() => this.segment() === GroupsSegments.Feed);

  /** First load of the segment on screen, with nothing under it yet. */
  readonly showSkeleton = computed(() => {
    if (this._isFeed()) {
      return this._feedLoading() && this._feed().length === 0;
    }
    return this._mineLoading() && this._mine().length === 0;
  });

  /** The load failed and there is nothing to show instead. */
  readonly showLoadError = computed(() => {
    if (this._isFeed()) {
      return this._feedError() && this._feed().length === 0;
    }
    return this._mineError() && this._mine().length === 0;
  });

  /**
   * The last load failed but older rows are still under it. Keeping them is
   * right; letting them pass for current is not, so the page says so inline.
   */
  readonly isStale = computed(() => {
    if (this._isFeed()) {
      return this._feedError() && this._feed().length > 0;
    }
    return this._mineError() && this._mine().length > 0;
  });

  /** Loaded, and genuinely nothing there. */
  readonly isEmpty = computed(() => {
    if (this._isFeed()) {
      return this._feedLoaded() && this._feed().length === 0;
    }
    return this._mineLoaded() && this._mine().length === 0;
  });

  /** Load whichever segment is on screen, with the invitations over it. */
  load(opts: LoadOptions = {}): void {
    this.loadInvitations();
    if (this._isFeed()) {
      this.loadFeed(opts);
      this.loadMine({ force: opts.force });
      return;
    }
    this.loadMine(opts);
  }

  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  /**
   * Entering the page. Ionic keeps it alive in its stack, so a group joined
   * or left elsewhere still has to be picked up, but anything younger than
   * `FRESH_MS` is left alone.
   */
  reenter(): void {
    let fetchedAt = this._mineFetchedAt;
    if (this._isFeed()) {
      fetchedAt = this._feedFetchedAt;
    }
    if (fetchedAt > 0 && Date.now() - fetchedAt < FRESH_MS) {
      return;
    }
    this.refresh();
  }

  setSegment(segment: GroupsSegment): void {
    if (segment === this.segment()) {
      return;
    }
    this.segment.set(segment);
    // Fills a gap an earlier error left, or a first visit to this lens.
    this.load();
  }

  // ── Loaders ────────────────────────────────────────────────────────────

  loadFeed(opts: LoadOptions = {}): void {
    if (!opts.force && (this._feedLoading() || this._feedLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchFeed(1, opts.done);
  }

  loadMoreFeed(done?: (error?: unknown) => void): void {
    if (this._feedLoading() || !this.feedHasMore()) {
      done?.();
      return;
    }
    this._fetchFeed(this._feedPage() + 1, done);
  }

  loadMine(opts: LoadOptions = {}): void {
    if (!opts.force && (this._mineLoading() || this._mineLoaded())) {
      opts.done?.();
      return;
    }
    this._mineLoading.set(true);
    this._mineError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._groupService
      .getMyGroups({ silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (groups) => {
          this._mine.set(groups);
          this._mineLoaded.set(true);
          this._mineLoading.set(false);
          this._mineFetchedAt = Date.now();
          opts.done?.();
        },
        error: (error: unknown) => {
          this._mineError.set(true);
          this._mineLoading.set(false);
          opts.done?.(error);
        },
      });
  }

  /** Silent and best effort: the cards are extras, a failed read leaves them out. */
  loadInvitations(): void {
    this._groupService
      .getMyInvitations()
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => this._invitations.set(page.items),
        error: () => undefined,
      });
  }

  // ── Changes made on this page ──────────────────────────────────────────

  /** Like or unlike from the feed, patched in place from the answer. */
  toggleReaction(post: Post): Observable<{ reacted: boolean; count: number }> {
    return this._postService.toggleReaction(post.id).pipe(
      take(1),
      tap((result) => {
        let myReaction: string | null = null;
        if (result.reacted) {
          myReaction = 'LIKE';
        }
        this.patchPost({ ...post, reactionCount: result.count, myReaction });
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  patchPost(post: Post): void {
    this._feed.update((list) =>
      list.map((row) => {
        if (row.id === post.id) {
          return { ...row, ...post };
        }
        return row;
      }),
    );
  }

  removePost(postId: string): void {
    this._feed.update((list) => list.filter((row) => row.id !== postId));
    this._feedTotal.update((total) => Math.max(0, total - 1));
  }

  /** Joining: the card goes, and the new group's posts join both lists. */
  acceptInvitation(invitation: PendingGroupInvitation): Observable<{ groupId: string }> {
    return this._groupService.acceptInvitation(invitation.id).pipe(
      take(1),
      tap(() => {
        this._dropInvitation(invitation.id);
        this._groupsRefresh.notify();
        this.refresh();
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  declineInvitation(invitation: PendingGroupInvitation): Observable<void> {
    return this._groupService.declineInvitation(invitation.id).pipe(
      take(1),
      tap(() => this._dropInvitation(invitation.id)),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  private _dropInvitation(invitationId: string): void {
    this._invitations.update((list) => list.filter((row) => row.id !== invitationId));
  }

  private _fetchFeed(page: number, done?: (error?: unknown) => void): void {
    this._feedLoading.set(true);
    this._feedError.set(false);

    this._postService
      .getFeed(page, PAGE_SIZE)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          this._feed.update((list) => {
            if (page === 1) {
              return response.items;
            }
            return [...list, ...response.items];
          });
          this._feedTotal.set(response.total);
          this._feedPage.set(page);
          this._feedLoaded.set(true);
          this._feedLoading.set(false);
          this._feedFetchedAt = Date.now();
          done?.();
        },
        error: (error: unknown) => {
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) {
            this._feedError.set(true);
          }
          this._feedLoading.set(false);
          done?.(error);
        },
      });
  }
}
