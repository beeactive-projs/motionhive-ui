import {
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
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
  imports: [ButtonDirective, Dialog, TranslatePipe],
  templateUrl: './delete-post-dialog.html',
  styleUrl: './delete-post-dialog.scss',
})
export class DeletePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

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
          summary: this._translateService.instant('groups.toast.postDeleted'),
        });
        this.deleted.emit({ ...result, postId: post.id });
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.postDeleteFailed'),
          '',
          err,
        );
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
