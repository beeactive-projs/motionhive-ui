import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

export const HexAvatarSizes = {
  /** Bare brand dot — too small for initials, used inside chips and pills. */
  ExtraSmall: 'xs',
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
  /** The account hero avatar. */
  ExtraLarge: 'xl',
  /** The profile page's portrait. */
  Huge: '2xl',
} as const;

export type HexAvatarSize = (typeof HexAvatarSizes)[keyof typeof HexAvatarSizes];

export const HexAvatarTones = {
  Base: 'base',
  Shade: 'shade',
} as const;

export type HexAvatarTone = (typeof HexAvatarTones)[keyof typeof HexAvatarTones];

/**
 * The rounded flat-top hexagon from core's `mh-hex`, generated once for the one
 * variant this app needs (regular hexagon on R=50, corner radius 11) instead of
 * porting that component's geometry code. Same shape as web — change it there
 * and here together.
 */
const HEX_PATH =
  'M 94.50 40.47 Q 100.00 50.00 94.50 59.53 L 80.50 83.77 Q 75.00 93.30 64.00 93.30 ' +
  'L 36.00 93.30 Q 25.00 93.30 19.50 83.77 L 5.50 59.53 Q 0.00 50.00 5.50 40.47 ' +
  'L 19.50 16.23 Q 25.00 6.70 36.00 6.70 L 64.00 6.70 Q 75.00 6.70 80.50 16.23 ' +
  'L 94.50 40.47 Z';

/** Tight bounds of the path above — width:height is 1 : cos 30°. */
const HEX_VIEW_BOX = '0 6.7 100 86.6';

/** Clip paths are referenced by id, so every instance needs its own. */
let seq = 0;

/**
 * Hexagon avatar — the brand's signature shape.
 *
 * This is the one component in the app that carries real custom CSS. Ionic
 * ships no shape primitive, and `ion-avatar` hardcodes `border-radius: 50%`
 * with no variable to override it, so the hexagon cannot be expressed through
 * a documented Ionic API. Everything else here still goes through the theme:
 * the fill is an `--ion-color-*` variable, never a literal.
 */
@Component({
  selector: 'mh-hex-avatar',
  imports: [IonIcon],
  templateUrl: './hex-avatar.html',
  styleUrl: './hex-avatar.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[style.--hex-fill]': 'fillVariable()',
    '[style.--hex-ink]': '"var(--ion-color-" + color() + "-contrast)"',
  },
})
export class HexAvatar {
  /**
   * Used for the initials fallback and the accessible label. Leave it out for a
   * decorative hexagon: no initials, no label, nothing announced.
   */
  readonly name = input('');
  readonly imageUrl = input<string | null>(null);
  /**
   * Renders the hexagon as an icon tile instead of an avatar — for the things
   * that are not people (a role, a mode). Wins over `imageUrl`; `name` is still
   * required and becomes the accessible label.
   */
  readonly icon = input<string | null>(null);
  readonly size = input<HexAvatarSize>(HexAvatarSizes.Medium);
  /** Ionic palette name — the fill and text colour are both derived from it. */
  readonly color = input<string>('secondary');
  /**
   * Which step of the colour to fill with. A white glyph needs 3:1 against its
   * tile to pass WCAG AA, and the 500 step of Sky (2.8:1) and Emerald (2.2:1)
   * both miss it — `shade` drops those two to the 600 step, which clears it.
   */
  readonly tone = input<HexAvatarTone>(HexAvatarTones.Base);

  readonly path = HEX_PATH;
  readonly viewBox = HEX_VIEW_BOX;
  readonly clipId = `mh-hex-${seq++}`;
  readonly clipUrl = `url(#${this.clipId})`;

  readonly fillVariable = computed(() => {
    const suffix = this.tone() === HexAvatarTones.Shade ? '-shade' : '';
    return `var(--ion-color-${this.color()}${suffix})`;
  });

  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0]!.charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
    return (first + last).toUpperCase();
  });

  /** An icon tile ignores any image; initials are the last resort. */
  readonly showImage = computed(() => !this.icon() && !!this.imageUrl());
}
