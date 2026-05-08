import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RouterLink } from '@angular/router';
import { GroupsRefreshService, Post, PostService, showApiError } from 'core';
import { PostCard } from '../group-detail/_components/post-card/post-card';

@Component({
  selector: 'mh-groups-feed',
  imports: [
    ButtonModule,
    CardModule,
    SkeletonModule,
    ToastModule,
    RouterLink,
    PostCard,
  ],
  providers: [MessageService],
  templateUrl: './groups-feed.html',
  styleUrl: './groups-feed.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsFeed implements OnInit {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly posts = signal<Post[]>([]);
  readonly total = signal(0);

  readonly pageSize = 20;
  readonly currentPage = signal(1);
  readonly hasMore = computed(() => this.posts().length < this.total());

  private readonly _scrollSentinel =
    viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _observer?: IntersectionObserver;

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

  ngOnInit(): void {
    this.load();
    this._groupsRefreshService.refresh$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.currentPage.set(1);
    this._postService.getFeed(1, this.pageSize).subscribe({
      next: (res) => {
        this.posts.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Could not load feed', '', err);
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage() + 1;
    this._postService
      .getFeed(nextPage, this.pageSize)
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
          showApiError(
            this._messageService,
            'Could not load more posts',
            '',
            err,
          );
        },
      });
  }

  trackById = (_: number, p: Post) => p.id;
}
