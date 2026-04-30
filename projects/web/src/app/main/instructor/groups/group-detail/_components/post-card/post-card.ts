import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthStore, Post } from 'core';
import { PostReactionBar } from '../post-reaction-bar/post-reaction-bar';
import { PostCommentList } from '../post-comment-list/post-comment-list';

@Component({
  selector: 'mh-post-card',
  imports: [
    DatePipe,
    AvatarModule,
    Button,
    CardModule,
    Menu,
    PostReactionBar,
    PostCommentList,
  ],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  private readonly _authStore = inject(AuthStore);

  readonly post = input.required<Post>();
  /** True when the viewer is OWNER/MODERATOR of the *current* group context. */
  readonly canModerate = input<boolean>(false);
  readonly deleteRequested = output<Post>();
  readonly editRequested = output<Post>();

  readonly showComments = signal(false);

  readonly isAuthor = computed(
    () => this.post().authorId === this._authStore.user()?.id,
  );

  readonly canEdit = computed(() => this.isAuthor());
  readonly canDelete = computed(() => this.isAuthor() || this.canModerate());

  readonly menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    if (this.canEdit()) {
      items.push({
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.editRequested.emit(this.post()),
      });
    }
    if (this.canDelete()) {
      items.push({
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => this.deleteRequested.emit(this.post()),
      });
    }
    return items;
  });

  authorName(): string {
    const a = this.post().author;
    if (!a) return 'Member';
    return `${a.firstName} ${a.lastName}`;
  }

  authorInitials(): string {
    const a = this.post().author;
    if (!a) return '??';
    return `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`;
  }

  toggleComments(): void {
    this.showComments.update((v) => !v);
  }

  // Image grid display: max 4, with "+N" overlay on the 4th if more.
  visibleImages(): string[] {
    const list = this.post().mediaUrls ?? [];
    return list.slice(0, 4);
  }

  extraImageCount(): number {
    const total = this.post().mediaUrls?.length ?? 0;
    return total > 4 ? total - 4 : 0;
  }

  imageGridClass(): string {
    const n = this.visibleImages().length;
    if (n === 1) return 'grid-cols-1';
    if (n === 2) return 'grid-cols-2';
    if (n === 3) return 'grid-cols-2';
    return 'grid-cols-2';
  }
}
