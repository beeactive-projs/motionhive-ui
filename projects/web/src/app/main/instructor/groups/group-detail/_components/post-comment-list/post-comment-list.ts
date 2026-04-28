import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AuthStore, PostComment, PostService, showApiError } from 'core';

@Component({
  selector: 'mh-post-comment-list',
  imports: [
    FormsModule,
    DatePipe,
    AvatarModule,
    Button,
    SkeletonModule,
    Textarea,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './post-comment-list.html',
  styleUrl: './post-comment-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCommentList {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);

  readonly postId = input.required<string>();
  readonly active = input.required<boolean>();

  readonly loading = signal(false);
  readonly comments = signal<PostComment[]>([]);
  readonly newComment = signal('');
  readonly posting = signal(false);
  readonly replyingTo = signal<string | null>(null);
  readonly replyContent = signal('');

  // One-shot per (postId, activation). Prevents re-entry when `loading`
  // flips back to false on error — without this, a single failure (429,
  // network blip, anything) re-triggers the effect into an infinite loop.
  private _hasLoaded = false;

  private readonly _loadOnActivate = effect(() => {
    if (this.active() && !this._hasLoaded) {
      this._hasLoaded = true;
      this._load();
    }
  });

  private _load(): void {
    this.loading.set(true);
    this._postService.getComments(this.postId(), 1, 50).subscribe({
      next: (res) => {
        this.comments.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Could not load comments', "", err);
      },
    });
  }

  postComment(): void {
    const content = this.newComment().trim();
    if (!content || this.posting()) return;
    this.posting.set(true);
    this._postService.addComment(this.postId(), { content }).subscribe({
      next: (created) => {
        this.posting.set(false);
        this.newComment.set('');
        this.comments.update((list) => [...list, created]);
      },
      error: (err) => {
        this.posting.set(false);
        showApiError(this._messageService, 'Could not post comment', "", err);
      },
    });
  }

  startReply(commentId: string): void {
    this.replyingTo.set(commentId);
    this.replyContent.set('');
  }

  cancelReply(): void {
    this.replyingTo.set(null);
    this.replyContent.set('');
  }

  postReply(parentCommentId: string): void {
    const content = this.replyContent().trim();
    if (!content || this.posting()) return;
    this.posting.set(true);
    this._postService
      .addComment(this.postId(), { content, parentCommentId })
      .subscribe({
        next: (created) => {
          this.posting.set(false);
          this.replyingTo.set(null);
          this.replyContent.set('');
          this.comments.update((list) =>
            list.map((c) =>
              c.id === parentCommentId
                ? { ...c, replies: [...(c.replies ?? []), created] }
                : c,
            ),
          );
        },
        error: (err) => {
          this.posting.set(false);
          showApiError(this._messageService, 'Could not post reply', "", err);
        },
      });
  }

  confirmDelete(comment: PostComment): void {
    this._confirmationService.confirm({
      message: 'Delete this comment?',
      header: 'Delete comment',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this._delete(comment),
    });
  }

  private _delete(comment: PostComment): void {
    this._postService.deleteComment(this.postId(), comment.id).subscribe({
      next: () => {
        this.comments.update((list) =>
          list
            .filter((c) => c.id !== comment.id)
            .map((c) =>
              c.replies
                ? { ...c, replies: c.replies.filter((r) => r.id !== comment.id) }
                : c,
            ),
        );
      },
      error: (err) => {
        showApiError(this._messageService, 'Could not delete comment', "", err);
      },
    });
  }

  initials(c: PostComment): string {
    const a = c.author?.firstName?.charAt(0) ?? '?';
    const b = c.author?.lastName?.charAt(0) ?? '?';
    return `${a}${b}`;
  }

  fullName(c: PostComment): string {
    if (!c.author) return 'Unknown';
    return `${c.author.firstName} ${c.author.lastName}`;
  }

  isMine(c: PostComment): boolean {
    return c.authorId === this._authStore.user()?.id;
  }

  trackById = (_: number, c: PostComment) => c.id;
}
