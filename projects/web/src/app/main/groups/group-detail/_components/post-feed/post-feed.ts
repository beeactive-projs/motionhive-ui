import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { take } from 'rxjs';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Post, PostService, showApiError } from 'core';
import { PostCard } from '../post-card/post-card';
import { Divider } from "primeng/divider";

@Component({
  selector: 'mh-post-feed',
  imports: [Button, CardModule, SkeletonModule, PostCard, Divider],
  templateUrl: './post-feed.html',
  styleUrl: './post-feed.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostFeed {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly groupId = input.required<string>();
  readonly canPost = input.required<boolean>();
  readonly canModerate = input<boolean>(false);
  readonly createRequested = output<void>();
  readonly editRequested = output<Post>();
  readonly deleteRequested = output<Post>();

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly posts = signal<Post[]>([]);
  readonly total = signal(0);

  readonly pageSize = 20;
  readonly currentPage = signal(1);
  readonly hasMore = computed(() => this.posts().length < this.total());

  private readonly _scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _observer?: IntersectionObserver;

  // Auto-reload when groupId changes.
  private readonly _reload = effect(() => {
    const id = this.groupId();
    if (id) this.load();
  });

  constructor() {
    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  load(): void {
    this.loading.set(true);
    this.currentPage.set(1);
    this._postService.getGroupFeed(this.groupId(), 1, this.pageSize).subscribe({
      next: (res) => {
        this.posts.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Could not load posts', '', err);
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage() + 1;
    this._postService
      .getGroupFeed(this.groupId(), nextPage, this.pageSize)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          const seen = new Set(this.posts().map((p) => p.id));
          const fresh = res.items.filter((p) => !seen.has(p.id));
          this.posts.update((list) => [...list, ...fresh]);
          this.total.set(res.total);
          this.currentPage.set(nextPage);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loadingMore.set(false);
          showApiError(this._messageService, 'Could not load more posts', '', err);
        },
      });
  }

  /** Public API for the parent: prepend a freshly created post. */
  prependPost(post: Post): void {
    this.posts.update((list) => [post, ...list]);
    this.total.update((n) => n + 1);
  }

  /** Public API for the parent: remove a post (after delete). */
  removePost(postId: string): void {
    this.posts.update((list) => list.filter((p) => p.id !== postId));
    this.total.update((n) => Math.max(0, n - 1));
  }

  /** Public API for the parent: replace a post (after edit). */
  replacePost(post: Post): void {
    this.posts.update((list) =>
      list.map((p) => (p.id === post.id ? { ...p, ...post } : p)),
    );
  }

  trackById = (_: number, p: Post) => p.id;
}
