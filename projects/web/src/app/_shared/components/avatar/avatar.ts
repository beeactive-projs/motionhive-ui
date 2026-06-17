import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { AvatarUser } from 'core';
import { HexAvatar } from '../hex-avatar/hex-avatar';

export type AvatarSize = 'normal' | 'large' | 'xlarge';

/** Keyword size → hex avatar width (px). */
const HEX_PX: Record<AvatarSize, number> = { normal: 36, large: 48, xlarge: 72 };

/**
 * Shared user avatar.
 *
 * Renders MotionHive's **hexagon** avatar by default (brand identity) by
 * delegating to `<mh-hex-avatar>` — image clipped to the hex, or initials with
 * a deterministic per-user tone. Pass `[circle]="true"` to opt back into the
 * legacy circular PrimeNG avatar (used for the nav account menu and the
 * signed-in user's own profile hero, where the round "you" avatar is kept).
 */
@Component({
  selector: 'mh-avatar',
  imports: [AvatarModule, HexAvatar],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly user = input<AvatarUser | null | undefined>(null);
  readonly size = input<AvatarSize>('normal');
  readonly shape = input<'square' | 'circle' | undefined>('circle');
  readonly styleClass = input<string>('');
  /** Opt back into the legacy circular avatar (default is the brand hex). */
  readonly circle = input<boolean>(false);

  readonly image = computed(() => this.user()?.avatarUrl ?? undefined);
  readonly hexSize = computed(() => HEX_PX[this.size()]);

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const first = (u.firstName ?? '').charAt(0);
    const last = (u.lastName ?? '').charAt(0);
    return (first + last).toUpperCase() || '?';
  });
}
