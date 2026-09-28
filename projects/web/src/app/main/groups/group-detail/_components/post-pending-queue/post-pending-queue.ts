import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
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
import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

const PAGE_SIZE = 50;

type ModerationDecision = ModeratePostPayload['decision'];

@Component({
  selector: 'mh-post-pending-queue',
  imports: [
    DatePipe,
    HexAvatar,
    ButtonDirective,
    CardModule,
    SkeletonModule,
    TagModule,
    TranslatePipe,
  ],
  templateUrl: './post-pending-queue.html',
  styleUrl: './post-pending-queue.scss',
})
export class PostPendingQueue {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

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
          this._translateService.instant('groups.toast.pendingPostsLoadFailed'),
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
          summary: this._translateService.instant(
            decision === PostApprovalStates.Approved
              ? 'groups.toast.postApproved'
              : 'groups.toast.postRejected',
          ),
        });
      },
      error: (err) => {
        this.busyId.set(null);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.moderateFailed'),
          '',
          err,
        );
      },
    });
  }
}
