import { Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import {
  APP_HEX_SHAPE,
  HexShape,
  TILE_FRAME,
  tileFigure,
} from '../../../../_shared/config/hexagon.config';
import { FEELINGS, Feeling } from '../../workouts.config';

/** Clip paths are referenced by id, so every instance needs its own. */
let seq = 0;

/**
 * How the session felt, 1 to 5, as honey cells filling up: the brand hexagon
 * holds more honey the better it went, and the one picked is full. The same
 * five values the API has always stored; only the picture is new.
 *
 * Read-only on a past workout, where the picked cell is the point and the
 * rest step back.
 */
@Component({
  selector: 'mh-feeling-scale',
  imports: [TranslatePipe],
  templateUrl: './feeling-scale.html',
  styleUrl: './feeling-scale.scss',
  host: { '[class.readonly]': '!editable()' },
})
export class FeelingScale {
  readonly value = model<number | null>(null);
  readonly editable = input(true);
  /** Names the group for a screen reader; the visible heading sits outside. */
  readonly label = input.required<string>();

  /** Classic, the app's hexagon; `logo` for the brand's own. */
  readonly shape = input<HexShape>(APP_HEX_SHAPE);

  readonly feelings = FEELINGS;
  /**
   * The tile's hexagon, laid out in the tiles' frame like an avatar (the
   * logo's points reach a little past it).
   */
  readonly hex = computed(() => tileFigure(this.shape()));
  readonly frame = TILE_FRAME;
  private readonly _id = `mh-feeling-${++seq}`;

  clipId(feeling: Feeling): string {
    return `${this._id}-${feeling.value}`;
  }

  /**
   * How much of the cell is honey, all of it once picked, as a scale from
   * the bottom: a transform animates everywhere, SVG geometry does not.
   */
  honeyScale(feeling: Feeling): string {
    return `scaleY(${this.value() === feeling.value ? 1 : feeling.fill})`;
  }

  pick(feeling: Feeling): void {
    if (!this.editable()) return;
    this.value.set(feeling.value);
    void this._tick();
  }

  /** A light tap with the fill. Never let a missing taptic engine break a pick. */
  private async _tick(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // No haptics on this device or platform.
    }
  }
}
