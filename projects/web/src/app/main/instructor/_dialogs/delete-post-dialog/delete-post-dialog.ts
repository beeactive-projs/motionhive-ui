import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import {
  DeletePostResult,
  Group,
  Post,
  PostService,
  showApiError,
} from 'core';

interface AudienceOption {
  groupId: string;
  groupName: string;
}

@Component({
  selector: 'mh-delete-post-dialog',
  imports: [FormsModule, Button, Checkbox, Dialog],
  templateUrl: './delete-post-dialog.html',
  styleUrl: './delete-post-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly post = input<Post | null>(null);
  /** Used to resolve audience IDs to display names. */
  readonly userGroups = input.required<Group[]>();
  readonly deleted = output<DeletePostResult & { postId: string }>();

  readonly selectedGroupIds = signal<string[]>([]);
  readonly deleteAll = signal(false);
  readonly submitting = signal(false);

  readonly audienceOptions = computed<AudienceOption[]>(() => {
    const post = this.post();
    if (!post?.audiences) return [];
    const groups = new Map(this.userGroups().map((g) => [g.id, g.name]));
    return post.audiences
      .filter((a) => a.audienceType === 'GROUP' && a.audienceId)
      .map((a) => ({
        groupId: a.audienceId!,
        groupName: groups.get(a.audienceId!) ?? a.audienceId!,
      }));
  });

  readonly multiAudience = computed(() => this.audienceOptions().length > 1);

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (!this.multiAudience()) return true;
    return this.deleteAll() || this.selectedGroupIds().length > 0;
  });

  private readonly _resetOnOpen = effect(() => {
    if (this.visible()) {
      this.deleteAll.set(!this.multiAudience());
      this.selectedGroupIds.set([]);
      this.submitting.set(false);
    }
  });

  submit(): void {
    const post = this.post();
    if (!post || !this.canSubmit()) return;
    this.submitting.set(true);
    const groupIds =
      !this.multiAudience() || this.deleteAll()
        ? undefined
        : this.selectedGroupIds();

    this._postService.deletePost(post.id, { groupIds }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary:
            result.post === 'deleted'
              ? 'Post deleted'
              : `Removed from ${result.audiencesRemoved} group(s)`,
        });
        this.deleted.emit({ ...result, postId: post.id });
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(this._messageService, 'Could not delete post', "", err);
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
