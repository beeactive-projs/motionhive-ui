import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, take, tap } from 'rxjs';

import { Post, PostComment, PostService } from 'core';

const PAGE_SIZE = 20;

/** `done` fires on every exit so a refresher spinner can never hang. */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * One post and its comments.
 *
 * Comments nest one level and no further: the API returns top-level rows
 * each carrying their own `replies`, and rejects a reply to a reply with
 * "Replies can only be added to top-level comments". So a reply always
 * targets the thread root, never the comment tapped.
 */
@Injectable()
export class PostDetailStore {
  private readonly _postService = inject(PostService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _postId = '';

  private readonly _post = signal<Post | null>(null);
  private readonly _postLoading = signal(false);
  private readonly _postError = signal(false);

  private readonly _comments = signal<PostComment[]>([]);
  private readonly _commentsTotal = signal(0);
  private readonly _commentsPage = signal(1);
  private readonly _commentsLoading = signal(false);
  private readonly _commentsError = signal(false);
  private readonly _commentsLoaded = signal(false);

  readonly post = this._post.asReadonly();
  readonly comments = this._comments.asReadonly();

  readonly commentsHasMore = computed(
    () => this._comments().length < this._commentsTotal(),
  );

  readonly showPostSkeleton = computed(() => this._postLoading() && !this._post());
  readonly showPostError = computed(() => this._postError() && !this._post());

  readonly showCommentsSkeleton = computed(
    () => this._commentsLoading() && this._comments().length === 0,
  );

  readonly showCommentsError = computed(
    () => this._commentsError() && this._comments().length === 0,
  );

  /**
   * The last load failed but older rows are still under it. Keeping them is
   * right; letting them pass for current is not, so the page says so inline
   * with a retry rather than raising a toast that is gone before it is read.
   */
  readonly isStale = computed(
    () => this._commentsError() && this._comments().length > 0,
  );

  readonly isEmpty = computed(
    () => this._commentsLoaded() && this._comments().length === 0,
  );

  /**
   * Every comment on the post, replies included. `post.commentCount` counts
   * the same way, so the two never disagree on screen.
   */
  readonly commentCount = computed(() =>
    this._comments().reduce((total, comment) => total + 1 + (comment.replies?.length ?? 0), 0),
  );

  /** Called once by the page with the id from the route. */
  init(postId: string): void {
    if (postId === this._postId) return;
    this._postId = postId;
    this._resetAll();
    this.load();
  }

  load(opts: LoadOptions = {}): void {
    this._loadPost(opts.force);
    this._loadComments(opts);
  }

  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  loadMoreComments(done?: (error?: unknown) => void): void {
    if (this._commentsLoading() || !this.commentsHasMore()) {
      done?.();
      return;
    }
    this._fetchComments(this._commentsPage() + 1, done);
  }

  // ── Verbs ──────────────────────────────────────────────────────────────

  /**
   * Like or unlike. The count comes back from the server rather than being
   * incremented locally: two devices on the same post would otherwise drift,
   * and the response is authoritative.
   */
  toggleReaction(): Observable<{ reacted: boolean; count: number }> {
    return this._postService.toggleReaction(this._postId).pipe(
      take(1),
      tap((result) => {
        this._post.update((post) =>
          post
            ? {
                ...post,
                reactionCount: result.count,
                myReaction: result.reacted ? 'LIKE' : null,
              }
            : post,
        );
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  /**
   * Add a comment, or a reply to one.
   *
   * `parentCommentId` is the thread root, which is not always the comment
   * the viewer tapped: replying to a reply is a 400 on the API, so the page
   * resolves the root before calling and the new row is spliced under it.
   */
  addComment(content: string, parentCommentId?: string): Observable<PostComment> {
    return this._postService
      .addComment(this._postId, { content, ...(parentCommentId ? { parentCommentId } : {}) })
      .pipe(
        take(1),
        tap((comment) => {
          if (parentCommentId) {
            this._comments.update((list) =>
              list.map((row) =>
                row.id === parentCommentId
                  ? { ...row, replies: [...(row.replies ?? []), comment] }
                  : row,
              ),
            );
          } else {
            // Appended, matching the API's oldest-first order.
            this._comments.update((list) => [...list, comment]);
            this._commentsTotal.update((total) => total + 1);
            this._commentsLoaded.set(true);
          }
          this._bumpCommentCount(1);
        }),
        takeUntilDestroyed(this._destroyRef),
      );
  }

  /**
   * Delete a comment, or a reply.
   *
   * Deleting a top-level comment takes its replies with it — the API
   * cascades — so the count drops by the whole thread, not by one.
   */
  deleteComment(commentId: string): Observable<unknown> {
    return this._postService.deleteComment(this._postId, commentId).pipe(
      take(1),
      tap(() => {
        const root = this._comments().find((row) => row.id === commentId);
        if (root) {
          const removed = 1 + (root.replies?.length ?? 0);
          this._comments.update((list) => list.filter((row) => row.id !== commentId));
          this._commentsTotal.update((total) => Math.max(0, total - 1));
          this._bumpCommentCount(-removed);
          return;
        }
        // A reply: it lives inside its root's `replies`, and the total counts
        // roots only, so that stays put.
        this._comments.update((list) =>
          list.map((row) =>
            row.replies?.some((reply) => reply.id === commentId)
              ? { ...row, replies: row.replies.filter((reply) => reply.id !== commentId) }
              : row,
          ),
        );
        this._bumpCommentCount(-1);
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  /** Rewriting the body. Content only — images are not editable on web either. */
  updatePost(content: string): Observable<Post> {
    return this._postService.updatePost(this._postId, { content }).pipe(
      take(1),
      tap((updated) => {
        // Merged rather than replaced: the update response does not carry
        // the author or the counts this screen is already showing.
        this._post.update((post) => (post ? { ...post, content: updated.content } : post));
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  deletePost(): Observable<unknown> {
    return this._postService
      .deletePost(this._postId)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef));
  }

  // ── Fetching ───────────────────────────────────────────────────────────

  private _loadPost(force = false): void {
    if (!force && (this._postLoading() || this._post())) return;
    this._postLoading.set(true);
    this._postError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._postService
      .getPostById(this._postId)
      .pipe(
        take(1),
        finalize(() => this._postLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (post) => this._post.set(post),
        error: () => this._postError.set(true),
      });
  }

  private _loadComments(opts: LoadOptions = {}): void {
    if (!opts.force && (this._commentsLoading() || this._commentsLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchComments(1, opts.done);
  }

  private _fetchComments(page: number, done?: (error?: unknown) => void): void {
    this._commentsLoading.set(true);
    this._commentsError.set(false);

    this._postService
      .getComments(this._postId, page, PAGE_SIZE)
      .pipe(
        take(1),
        finalize(() => this._commentsLoading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (response) => {
          this._comments.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._commentsTotal.set(response.total);
          this._commentsPage.set(page);
          this._commentsLoaded.set(true);
          done?.();
        },
        error: (error: unknown) => {
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._commentsError.set(true);
          done?.(error);
        },
      });
  }

  /** Keeps the post's own counter honest after a comment lands or goes. */
  private _bumpCommentCount(delta: number): void {
    this._post.update((post) =>
      post ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post,
    );
  }

  private _resetAll(): void {
    this._post.set(null);
    this._postError.set(false);
    this._comments.set([]);
    this._commentsTotal.set(0);
    this._commentsPage.set(1);
    this._commentsLoaded.set(false);
    this._commentsError.set(false);
  }
}
