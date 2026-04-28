import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Post, PostService, showApiError } from 'core';
import { PostCard } from '../post-card/post-card';

@Component({
  selector: 'mh-post-feed',
  imports: [Button, CardModule, SkeletonModule, PostCard],
  templateUrl: './post-feed.html',
  styleUrl: './post-feed.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostFeed {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);

  readonly groupId = input.required<string>();
  readonly canPost = input.required<boolean>();
  readonly canModerate = input<boolean>(false);
  readonly createRequested = output<void>();
  readonly editRequested = output<Post>();
  readonly deleteRequested = output<Post>();

  readonly loading = signal(true);
  readonly posts = signal<Post[]>([]);
  readonly total = signal(0);

  // Auto-reload when groupId changes.
  private readonly _reload = effect(() => {
    const id = this.groupId();
    if (id) this.load();
  });

  load(): void {
    this.loading.set(true);
    this._postService.getGroupFeed(this.groupId(), 1, 20).subscribe({
      next: (res) => {
        this.posts.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Could not load posts', "", err);
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
