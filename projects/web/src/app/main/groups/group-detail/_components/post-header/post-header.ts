import {
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthStore, Post } from 'core';
import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

@Component({
  selector: 'mh-post-header',
  imports: [DatePipe, RouterLink, HexAvatar, ButtonDirective, Menu, TranslatePipe],
  templateUrl: './post-header.html',
})
export class PostHeader {
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);

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
        label: this._translateService.instant('button.edit'),
        icon: 'pi pi-pencil',
        command: () => this.editRequested.emit(this.post()),
      });
    }
    if (this.canDelete()) {
      items.push({
        label: this._translateService.instant('button.delete'),
        icon: 'pi pi-trash',
        styleClass: 'mh-menu-danger',
        command: () => this.deleteRequested.emit(this.post()),
      });
    }
    return items;
  });

  authorName(): string {
    const a = this.post().author;
    if (!a) return this._translateService.instant('groups.post.unknownAuthor');
    return `${a.firstName} ${a.lastName}`;
  }
}
