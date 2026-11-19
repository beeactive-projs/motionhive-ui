import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { Post, PostService, displayName, formatRelativeShort } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../../../_shared/components/confirm-sheet/confirm-sheet';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { groupLinks } from '../../../../_shared/utils/stack-paths';
import { POST_MAX_LENGTH } from '../../groups.config';
import { PostActionId, PostActionIds, PostPermissions, postActions } from './post-actions.config';

/**
 * Everything the ⋯ on a post opens: the verbs (View profile, Edit post,
 * Delete post), the edit sheet and the red confirm. The feed, a group's
 * Posts tab and the post page share it, so a post's verbs read the same
 * wherever it is.
 *
 * The parent passes what the reader may do with `show(post, permissions)`
 * and patches its own list from `updated` and `deleted`.
 */
@Component({
  selector: 'mh-post-actions',
  imports: [ActionSheet, ConfirmSheet, IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './post-actions.html',
})
export class PostActions {
  private readonly _postService = inject(PostService);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly updated = output<Post>();
  readonly deleted = output<string>();

  readonly postMaxLength = POST_MAX_LENGTH;

  readonly post = signal<Post | null>(null);
  private readonly _permissions = signal<PostPermissions>({ canEdit: false, canDelete: false });

  readonly sheetOpen = signal(false);
  readonly editOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly editDraft = signal('');
  readonly saving = signal(false);
  readonly deleting = signal(false);

  readonly authorName = computed(() => {
    const post = this.post();
    if (!post) {
      return '';
    }
    return displayName(post.author, this._translateService.instant('groups.common.member'));
  });

  readonly subtitle = computed(() => {
    const post = this.post();
    if (!post) {
      return '';
    }
    const time = formatRelativeShort(post.postedAt);
    if (post.group) {
      return `${post.group.name} · ${time}`;
    }
    return time;
  });

  readonly actions = computed(() => {
    const post = this.post();
    if (!post) {
      return [];
    }
    return postActions(post, this._permissions());
  });

  readonly canSaveEdit = computed(() => {
    const draft = this.editDraft().trim();
    const post = this.post();
    if (!post || this.saving()) {
      return false;
    }
    return draft.length > 0 && draft.length <= POST_MAX_LENGTH && draft !== post.content;
  });

  show(post: Post, permissions: PostPermissions): void {
    this.post.set(post);
    this._permissions.set(permissions);
    this.sheetOpen.set(true);
  }

  onChosen(id: PostActionId): void {
    const post = this.post();
    if (!post) {
      return;
    }
    if (id === PostActionIds.Profile) {
      const handle = post.author?.handle;
      if (handle) {
        void this._router.navigate(groupLinks(this._router.url).person(handle));
      }
      return;
    }
    if (id === PostActionIds.Edit) {
      this.editDraft.set(post.content);
      this.editOpen.set(true);
      return;
    }
    this.deleteOpen.set(true);
  }

  onEditDraft(value: string): void {
    this.editDraft.set(value);
  }

  saveEdit(): void {
    const post = this.post();
    if (!post || !this.canSaveEdit()) {
      return;
    }
    this.saving.set(true);
    const content = this.editDraft().trim();
    this._postService
      .updatePost(post.id, { content })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editOpen.set(false);
          this.updated.emit({ ...post, content });
          void this._feedbackService.success(
            this._translateService.instant('groups.post.toast.updated'),
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.post.toast.editFailed'),
          );
        },
      });
  }

  confirmDelete(): void {
    const post = this.post();
    if (!post || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this._postService
      .deletePost(post.id)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteOpen.set(false);
          this.deleted.emit(post.id);
          void this._feedbackService.success(
            this._translateService.instant('groups.post.toast.deleted'),
          );
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.post.toast.deleteFailed'),
          );
        },
      });
  }
}
