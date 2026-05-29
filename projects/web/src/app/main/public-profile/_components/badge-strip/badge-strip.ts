import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ProfileBadge } from 'core';

/**
 * Credibility badge row rendered under the hero meta line. Pills style
 * for now (the most compact); ribbon + medals variants ship when the
 * backend payload makes it worth differentiating.
 *
 * Backend computes badges per the design contract §5 ("What to award").
 * If `badges()` is empty the component renders nothing — we never
 * fabricate placeholder badges.
 */
@Component({
  selector: 'mh-badge-strip',
  imports: [],
  templateUrl: './badge-strip.html',
  styleUrl: './badge-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeStrip {
  readonly badges = input.required<readonly ProfileBadge[]>();

  /** Maps `IconName` from the design contract to the closest `pi-*` glyph. */
  iconClass(icon: string): string {
    switch (icon) {
      case 'check': return 'pi pi-check-circle';
      case 'star': return 'pi pi-star-fill';
      case 'bolt': return 'pi pi-bolt';
      case 'shield': return 'pi pi-shield';
      case 'flame': return 'pi pi-fire';
      case 'trophy': return 'pi pi-trophy';
      case 'leaf': return 'pi pi-sun';
      case 'sparkle': return 'pi pi-sparkles';
      case 'users': return 'pi pi-users';
      case 'target': return 'pi pi-bullseye';
      case 'dumbbell': return 'pi pi-stopwatch';
      case 'heart': return 'pi pi-heart';
      case 'lock': return 'pi pi-lock';
      default: return 'pi pi-circle';
    }
  }
}
