import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Post, PostService, showApiError } from 'core';

@Component({
  selector: 'mh-post-pending-queue',
  imports: [DatePipe, AvatarModule, Button, CardModule, SkeletonModule, TagModule],
  templateUrl: './post-pending-queue.html',
  styleUrl: './post-pending-queue.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostPendingQueue {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);

  readonly groupId = input.required<string>();

  readonly loading = signal(true);
  readonly pending = signal<Post[]>([]);
  readonly busyId = signal<string | null>(null);

  readonly count = computed(() => this.pending().length);

  private readonly _reload = effect(() => {
    const id = this.groupId();
    if (id) this.load();
  });

  load(): void {
    this.loading.set(true);
    this._postService.getPendingForGroup(this.groupId(), 1, 50).subscribe({
      next: (res) => {
        this.pending.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          'Could not load pending posts',
          '',
          err,
        );
      },
    });
  }

  approve(post: Post): void {
    this._decide(post, 'APPROVED');
  }

  reject(post: Post): void {
    this._decide(post, 'REJECTED');
  }

  private _decide(post: Post, decision: 'APPROVED' | 'REJECTED'): void {
    if (this.busyId()) return;
    this.busyId.set(post.id);
    this._postService.moderatePost(post.id, { decision }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.pending.update((list) => list.filter((p) => p.id !== post.id));
        this._messageService.add({
          severity: 'success',
          summary:
            decision === 'APPROVED' ? 'Post approved' : 'Post rejected',
        });
      },
      error: (err) => {
        this.busyId.set(null);
        showApiError(
          this._messageService,
          'Could not moderate post',
          '',
          err,
        );
      },
    });
  }

  authorName(p: Post): string {
    if (!p.author) return 'Member';
    return `${p.author.firstName} ${p.author.lastName}`;
  }

  authorInitials(p: Post): string {
    if (!p.author) return '??';
    return `${p.author.firstName.charAt(0)}${p.author.lastName.charAt(0)}`;
  }

  trackById = (_: number, p: Post) => p.id;
}
