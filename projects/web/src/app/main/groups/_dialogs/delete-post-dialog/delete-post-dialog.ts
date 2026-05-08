import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import {
  DeletePostResult,
  Post,
  PostService,
  showApiError,
} from 'core';

@Component({
  selector: 'mh-delete-post-dialog',
  imports: [Button, Dialog],
  templateUrl: './delete-post-dialog.html',
  styleUrl: './delete-post-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly post = input<Post | null>(null);
  readonly deleted = output<DeletePostResult & { postId: string }>();

  readonly submitting = signal(false);

  submit(): void {
    const post = this.post();
    if (!post || this.submitting()) return;
    this.submitting.set(true);

    this._postService.deletePost(post.id).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Post deleted',
        });
        this.deleted.emit({ ...result, postId: post.id });
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(this._messageService, 'Could not delete post', '', err);
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
