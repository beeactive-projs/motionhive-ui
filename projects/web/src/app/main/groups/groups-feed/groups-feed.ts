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
import { ActivatedRoute, Router } from '@angular/router';
import { Group, GroupsRefreshService, Post, PostService, showApiError } from 'core';
import { PostCard } from '../group-detail/_components/post-card/post-card';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { CreatePostDialog } from '../_dialogs/create-post-dialog/create-post-dialog';
import { DeletePostDialog } from '../_dialogs/delete-post-dialog/delete-post-dialog';

@Component({
  selector: 'mh-groups-feed',
  imports: [
    ButtonModule,
    CardModule,
    SkeletonModule,
    ToastModule,
    PostCard,
    ListEmptyState,
    CreatePostDialog,
    DeletePostDialog,
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
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  goToDiscover(): void {
    this._router.navigate(['../discover'], { relativeTo: this._route });
  }

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly posts = signal<Post[]>([]);
  readonly total = signal(0);

  // ── Post edit / delete (author or moderator — see post-header) ──
  // The edit dialog hides the group picker, so it doesn't need a real
  // group list; the required input is satisfied with an empty array.
  readonly noGroups: Group[] = [];
  readonly showEditDialog = signal(false);
  readonly postBeingEdited = signal<Post | null>(null);
  readonly showDeleteDialog = signal(false);
  readonly postBeingDeleted = signal<Post | null>(null);

  onEditRequested(post: Post): void {
    this.postBeingEdited.set(post);
    this.showEditDialog.set(true);
  }

  onPostUpdated(posts: Post[]): void {
    const updated = posts[0];
    if (!updated) return;
    this.posts.update((list) =>
      list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }

  onDeleteRequested(post: Post): void {
    this.postBeingDeleted.set(post);
    this.showDeleteDialog.set(true);
  }

  onDeleted(result: { postId: string }): void {
    this.posts.update((list) => list.filter((p) => p.id !== result.postId));
    this.total.update((n) => Math.max(0, n - 1));
  }

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
