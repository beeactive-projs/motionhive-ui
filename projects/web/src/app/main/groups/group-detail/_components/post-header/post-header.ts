import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthStore, Post } from 'core';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-post-header',
  imports: [DatePipe, RouterLink, Avatar, Button, Menu],
  templateUrl: './post-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostHeader {
  private readonly _authStore = inject(AuthStore);

  readonly post = input.required<Post>();
  readonly canModerate = input<boolean>(false);
  readonly showGroupBadge = input<boolean>(false);
  readonly deleteRequested = output<Post>();
  readonly editRequested = output<Post>();

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
}
