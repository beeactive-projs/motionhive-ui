import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { AvatarUser } from 'core';

export type AvatarSize = 'normal' | 'large' | 'xlarge';

@Component({
  selector: 'mh-avatar',
  imports: [AvatarModule],
  templateUrl: './avatar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly user = input<AvatarUser | null | undefined>(null);
  readonly size = input<AvatarSize>('normal');
  readonly styleClass = input<string>('');

  readonly image = computed(() => this.user()?.avatarUrl ?? undefined);

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const first = (u.firstName ?? '').charAt(0);
    const last = (u.lastName ?? '').charAt(0);
    return (first + last).toUpperCase() || '?';
  });
}
