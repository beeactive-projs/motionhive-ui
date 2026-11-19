import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, take, tap } from 'rxjs';

import { GroupJoinRequest, GroupService, Post, PostService } from 'core';

const PAGE_SIZE = 20;

/** `done` fires on every exit so a refresher spinner can never hang. */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * The owner's two queues: people waiting to join, and posts waiting for
 * review.
 *
 * They load together rather than per tab. Both are small, both are the
 * reason the owner opened this screen, and the badge on each tab has to be
 * right before either is looked at — a count that appears only once you
 * visit the tab is a count that never made you visit it.
 */
@Injectable()
export class GroupManageStore {
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _groupId = '';

  private readonly _requests = signal<GroupJoinRequest[]>([]);
  private readonly _requestsTotal = signal(0);
  private readonly _requestsLoading = signal(false);
  private readonly _requestsError = signal(false);
  private readonly _requestsLoaded = signal(false);

  private readonly _posts = signal<Post[]>([]);
  private readonly _postsTotal = signal(0);
  private readonly _postsLoading = signal(false);
  private readonly _postsError = signal(false);
  private readonly _postsLoaded = signal(false);

  /** Rows with a decision in flight, so each can spin on its own. */
  private readonly _busyIds = signal<ReadonlySet<string>>(new Set());

  /**
   * Which queues answered 403. A moderator reviews posts but never sees join
   * requests, so the requests queue alone refusing is normal for them; both
   * refusing means this viewer is not staff here.
   *
   * Told apart from a failed load because they are different news: one is
   * "try again", the other is "this was never yours to see".
   */
  private readonly _requestsForbidden = signal(false);
  private readonly _postsForbidden = signal(false);

  readonly forbidden = computed(() => this._requestsForbidden() && this._postsForbidden());

  /** Whether the viewer may see join requests (the owner only). */
  readonly requestsAllowed = computed(() => !this._requestsForbidden());

  readonly requests = this._requests.asReadonly();
  readonly posts = this._posts.asReadonly();

  /**
   * How many wait on the server, not how many are on screen: a queue reads
   * a page of 20, so 35 requests used to show as 20.
   */
  readonly requestCount = this._requestsTotal.asReadonly();
  readonly postCount = this._postsTotal.asReadonly();

  /** The page on screen is decided and the next one is on its way. */
  readonly requestsRefilling = computed(
    () => this._requests().length === 0 && this._requestsLoading(),
  );
  readonly postsRefilling = computed(() => this._posts().length === 0 && this._postsLoading());

  readonly loading = computed(() => this._requestsLoading() || this._postsLoading());

  readonly showSkeleton = computed(
    () => this.loading() && !this._requestsLoaded() && !this._postsLoaded(),
  );

  /** Both queues failed and there is nothing to show instead. */
  readonly showError = computed(
    () =>
      !this.forbidden() &&
      (this._requestsError() || this._requestsForbidden()) &&
      this._postsError() &&
      this._requests().length === 0 &&
      this._posts().length === 0,
  );

  isBusy(id: string): boolean {
    return this._busyIds().has(id);
  }

  init(groupId: string): void {
    if (groupId === this._groupId) return;
    this._groupId = groupId;
    this._resetAll();
    this.load();
  }

  load(opts: LoadOptions = {}): void {
    // `done` fires once, after both queues settle — a refresher completed on
    // the first of two would stop spinning with half the screen still loading.
    let pending = 2;
    let firstError: unknown;
    const settle = (error?: unknown) => {
      if (error !== undefined && firstError === undefined) firstError = error;
      pending -= 1;
      if (pending === 0) opts.done?.(firstError);
    };
    this._loadRequests(opts.force, settle);
    this._loadPosts(opts.force, settle);
  }

  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  /**
   * Approve or reject someone. The row leaves the queue either way — a
   * decision made is not a decision still waiting.
   */
  decideRequest(request: GroupJoinRequest, action: 'APPROVE' | 'REJECT'): Observable<unknown> {
    this._markBusy(request.id, true);
    return this._groupService.decideJoinRequest(this._groupId, request.id, { action }).pipe(
      take(1),
      finalize(() => this._markBusy(request.id, false)),
      tap(() => {
        this._requests.update((list) => list.filter((row) => row.id !== request.id));
        this._requestsTotal.update((total) => Math.max(0, total - 1));
        // Deciding the last one on screen is not the end of the queue while
        // the server still holds more: read the next ones in.
        if (this._requests().length === 0 && this._requestsTotal() > 0) {
          this._loadRequests(true, noop);
        }
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  moderatePost(post: Post, decision: 'APPROVED' | 'REJECTED'): Observable<unknown> {
    this._markBusy(post.id, true);
    return this._postService.moderatePost(post.id, { decision }).pipe(
      take(1),
      finalize(() => this._markBusy(post.id, false)),
      tap(() => {
        this._posts.update((list) => list.filter((row) => row.id !== post.id));
        this._postsTotal.update((total) => Math.max(0, total - 1));
        if (this._posts().length === 0 && this._postsTotal() > 0) {
          this._loadPosts(true, noop);
        }
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  private _markBusy(id: string, busy: boolean): void {
    this._busyIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private _loadRequests(force = false, done: (error?: unknown) => void): void {
    if (!force && (this._requestsLoading() || this._requestsLoaded())) {
      done();
      return;
    }
    this._requestsLoading.set(true);
    this._requestsError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._groupService
      .listJoinRequests(this._groupId, 1, PAGE_SIZE)
      .pipe(
        take(1),
        finalize(() => this._requestsLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (response) => {
          this._requests.set(response.items);
          this._requestsTotal.set(response.total);
          this._requestsLoaded.set(true);
          done();
        },
        error: (error: unknown) => {
          this._requestsError.set(true);
          if (isForbidden(error)) {
            this._requestsForbidden.set(true);
          }
          done(error);
        },
      });
  }

  private _loadPosts(force = false, done: (error?: unknown) => void): void {
    if (!force && (this._postsLoading() || this._postsLoaded())) {
      done();
      return;
    }
    this._postsLoading.set(true);
    this._postsError.set(false);

    this._postService
      .getPendingForGroup(this._groupId, 1, PAGE_SIZE)
      .pipe(
        take(1),
        finalize(() => this._postsLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (response) => {
          this._posts.set(response.items);
          this._postsTotal.set(response.total);
          this._postsLoaded.set(true);
          done();
        },
        error: (error: unknown) => {
          this._postsError.set(true);
          if (isForbidden(error)) {
            this._postsForbidden.set(true);
          }
          done(error);
        },
      });
  }


  private _resetAll(): void {
    this._requests.set([]);
    this._requestsTotal.set(0);
    this._requestsLoaded.set(false);
    this._requestsError.set(false);
    this._posts.set([]);
    this._postsTotal.set(0);
    this._postsLoaded.set(false);
    this._postsError.set(false);
    this._busyIds.set(new Set());
    this._requestsForbidden.set(false);
    this._postsForbidden.set(false);
  }
}

function noop(): void {
  // A refill has no refresher waiting on it.
}

/** A refusal rather than a failure: the queue was never this viewer's. */
function isForbidden(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 403;
}
