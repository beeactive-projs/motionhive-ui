import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { AuthStore, Post } from 'core';
import { AvatarModule } from 'primeng/avatar';
import { CreatePostDialog } from '../../../_dialogs/create-post-dialog/create-post-dialog';
import { DeletePostDialog } from '../../../_dialogs/delete-post-dialog/delete-post-dialog';
import { GroupSidePanel } from '../../_components/group-side-panel/group-side-panel';
import { PostFeed } from '../../_components/post-feed/post-feed';
import { PostPendingQueue } from '../../_components/post-pending-queue/post-pending-queue';
import { GroupDetailContext } from '../../group-detail.context';

@Component({
  selector: 'mh-group-posts-tab',
  imports: [
    AvatarModule,
    PostFeed,
    PostPendingQueue,
    CreatePostDialog,
    DeletePostDialog,
    GroupSidePanel,
  ],
  templateUrl: './posts-tab.html',
  styleUrl: './posts-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsTab {
  private readonly _authStore = inject(AuthStore);
  readonly context = inject(GroupDetailContext);

  readonly postFeed = viewChild(PostFeed);

  readonly userInitials = computed(() => {
    const u = this._authStore.user();
    if (!u) return '?';
    return ((u.firstName?.charAt(0) ?? '') + (u.lastName?.charAt(0) ?? '')).toUpperCase() || '?';
  });

  openCreate(): void {
    this.context.openCreatePost();
  }

  onPostCreated(posts: Post[]): void {
    const groupId = this.context.group()?.id;
    if (!groupId) return;
    const local = posts.find((p) => p.groupId === groupId);
    if (local) this.postFeed()?.prependPost(local);
  }

  onDeleteRequested(post: Post): void {
    this.context.requestDeletePost(post);
  }

  onDeleted(result: { deleted: true; postId: string }): void {
    this.postFeed()?.removePost(result.postId);
  }
}
