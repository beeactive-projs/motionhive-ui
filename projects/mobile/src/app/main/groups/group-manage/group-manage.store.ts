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
  private readonly _requestsLoading = signal(false);
  private readonly _requestsError = signal(false);
  private readonly _requestsLoaded = signal(false);

  private readonly _posts = signal<Post[]>([]);
  private readonly _postsLoading = signal(false);
  private readonly _postsError = signal(false);
  private readonly _postsLoaded = signal(false);

  /** Rows with a decision in flight, so each can spin on its own. */
  private readonly _busyIds = signal<ReadonlySet<string>>(new Set());

  readonly requests = this._requests.asReadonly();
  readonly posts = this._posts.asReadonly();

  readonly requestCount = computed(() => this._requests().length);
  readonly postCount = computed(() => this._posts().length);

  readonly loading = computed(() => this._requestsLoading() || this._postsLoading());

  readonly showSkeleton = computed(
    () => this.loading() && !this._requestsLoaded() && !this._postsLoaded(),
  );

  /** Both queues failed and there is nothing to show instead. */
  readonly showError = computed(
    () =>
      this._requestsError() &&
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
          this._requestsLoaded.set(true);
          done();
        },
        error: (error: unknown) => {
          this._requestsError.set(true);
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
          this._postsLoaded.set(true);
          done();
        },
        error: (error: unknown) => {
          this._postsError.set(true);
          done(error);
        },
      });
  }

  private _resetAll(): void {
    this._requests.set([]);
    this._requestsLoaded.set(false);
    this._requestsError.set(false);
    this._posts.set([]);
    this._postsLoaded.set(false);
    this._postsError.set(false);
    this._busyIds.set(new Set());
  }
}
