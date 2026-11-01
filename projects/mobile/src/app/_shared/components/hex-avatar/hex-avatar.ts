import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import { APP_HEX_SHAPE, HexShape, TILE_FRAME, tileFigure } from '../../config/hexagon.config';

export const HexAvatarSizes = {
  /** Bare brand dot — too small for initials or a glyph, used as an ornament. */
  Dot: 'dot',
  /** The leading tile of a chip or pill — holds an icon, initials at a push. */
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
  Wash: 'wash',
} as const;

export type HexAvatarTone = (typeof HexAvatarTones)[keyof typeof HexAvatarTones];

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
 *
 * The shape is the app's classic hexagon on its side unless `shape` asks for
 * the logo's, on its point (the share sheet). Either way the size is the hexagon's
 * point to point length, and the avatar is laid out in the same frame
 * (`TILE_FRAME`), so a row is as tall in both; the logo's points reach a
 * little past the frame, above and below.
 */
@Component({
  selector: 'mh-hex-avatar',
  imports: [IonIcon],
  templateUrl: './hex-avatar.html',
  styleUrl: './hex-avatar.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[style.aspect-ratio]': 'frame.aspect',
    '[style.--hex-fill]': 'fillVariable()',
    '[style.--hex-ink]': 'inkVariable()',
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
   *
   * `wash` inverts the relationship: a pale fill with dark ink, for tiles that
   * repeat down a list and would otherwise turn it into a colour chart.
   */
  readonly tone = input<HexAvatarTone>(HexAvatarTones.Base);

  /** Classic, the app's hexagon; `logo` for the brand's own (the share sheet). */
  readonly shape = input<HexShape>(APP_HEX_SHAPE);

  readonly hex = computed(() => tileFigure(this.shape()));
  readonly frame = TILE_FRAME;
  readonly clipId = `mh-hex-${seq++}`;
  readonly clipUrl = `url(#${this.clipId})`;

  private readonly toneSuffix = computed(() => {
    switch (this.tone()) {
      case HexAvatarTones.Shade:
        return '-shade';
      case HexAvatarTones.Wash:
        return '-wash';
      default:
        return '';
    }
  });

  /**
   * The base tone goes through the slot's `-tile` extension when the palette
   * defines one: navy vanishes on the dark card, so dark mode lifts it there
   * (`theme/variables.css`).
   */
  readonly fillVariable = computed(() => {
    const slot = `--ion-color-${this.color()}`;
    return this.tone() === HexAvatarTones.Base
      ? `var(${slot}-tile, var(${slot}))`
      : `var(${slot}${this.toneSuffix()})`;
  });

  /**
   * Wash carries its own ink; base takes the tile's ink when the slot has a
   * tile extension, and shade the slot's contrast.
   */
  readonly inkVariable = computed(() => {
    const slot = `--ion-color-${this.color()}`;
    switch (this.tone()) {
      case HexAvatarTones.Wash:
        return `var(${slot}-wash-contrast)`;
      case HexAvatarTones.Base:
        return `var(${slot}-tile-contrast, var(${slot}-contrast))`;
      default:
        return `var(${slot}-contrast)`;
    }
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
