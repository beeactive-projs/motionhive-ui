import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type UserInfo as UserInfoData } from 'core';
import { Avatar } from '../avatar/avatar';
import { HexAvatar } from '../hex-avatar/hex-avatar';

@Component({
  selector: 'mh-user-info',
  imports: [Avatar, HexAvatar, RouterLink],
  templateUrl: './user-info.html',
  styleUrl: './user-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserInfo {
  readonly user = input<UserInfoData | null | undefined>();
  readonly showEmail = input<boolean>(false);
  readonly avatarStyleClass = input<string>('');
  /** Render the brand hexagon avatar instead of the circular one. */
  readonly hex = input<boolean>(false);
  /** Hex avatar width in px (only used when `hex` is true). */
  readonly hexSize = input<number>(36);

  protected readonly _displayName = computed(() => {
    const u = this.user();
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || '—';
  });

  protected readonly _hasHandle = computed(() => !!this.user()?.handle);
}
