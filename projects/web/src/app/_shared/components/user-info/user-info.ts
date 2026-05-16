import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type UserInfo as UserInfoData } from 'core';
import { Avatar } from '../avatar/avatar';

@Component({
  selector: 'mh-user-info',
  imports: [Avatar, RouterLink],
  templateUrl: './user-info.html',
  styleUrl: './user-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserInfo {
  readonly user = input<UserInfoData | null | undefined>();
  readonly showEmail = input<boolean>(false);
  readonly avatarStyleClass = input<string>('');

  protected readonly _displayName = computed(() => {
    const u = this.user();
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || '—';
  });

  protected readonly _hasHandle = computed(() => !!this.user()?.handle);
}
