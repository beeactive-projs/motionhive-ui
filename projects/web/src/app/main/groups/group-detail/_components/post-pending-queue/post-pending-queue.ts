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
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import {
  ModeratePostPayload,
  Post,
  PostApprovalStates,
  PostService,
  showApiError,
} from 'core';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';

const PAGE_SIZE = 50;

type ModerationDecision = ModeratePostPayload['decision'];

@Component({
  selector: 'mh-post-pending-queue',
  imports: [DatePipe, Avatar, Button, CardModule, SkeletonModule, TagModule],
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
  readonly isAnyBusy = computed(() => this.busyId() !== null);

  protected readonly skeletonRows = [1, 2];

  constructor() {
    effect(() => {
      const id = this.groupId();
      if (id) this._load(id);
    });
  }

  approve(post: Post): void {
    this._decide(post, PostApprovalStates.Approved);
  }

  reject(post: Post): void {
    this._decide(post, PostApprovalStates.Rejected);
  }

  isBusy(post: Post): boolean {
    return this.busyId() === post.id;
  }

  private _load(groupId: string): void {
    this.loading.set(true);
    this._postService.getPendingForGroup(groupId, 1, PAGE_SIZE).subscribe({
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

  private _decide(post: Post, decision: ModerationDecision): void {
    if (this.isAnyBusy()) return;
    this.busyId.set(post.id);
    this._postService.moderatePost(post.id, { decision }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.pending.update((list) => list.filter((p) => p.id !== post.id));
        this._messageService.add({
          severity: 'success',
          summary:
            decision === PostApprovalStates.Approved
              ? 'Post approved'
              : 'Post rejected',
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
}
