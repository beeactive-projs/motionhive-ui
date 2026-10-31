import { Component, computed, input } from '@angular/core';

import { HEX_PATH } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { HEX_HEIGHT, HiveCell, HiveCellKinds, HiveFills } from '../../home.config';

/** Gradient and clip ids are document-wide, so every instance needs its own. */
let seq = 0;

/**
 * A honeycomb: the coach's hive of clients and the trainee's week.
 *
 * Draws the app's own hexagon (`HEX_PATH`, the avatars' shape) stood on its
 * point, at the places `home.config.ts` computes, so the geometry is tested
 * and this only paints. A filled cell's honey rises from the bottom once,
 * when the cell first appears; reduced motion shows it already poured.
 *
 * It is one picture to a screen reader: `label` says what it shows, and the
 * cells are hidden. Its size is the placing card's: one cell is `--cell`
 * wide (see `hive.scss`).
 */
@Component({
  selector: 'mh-hive',
  templateUrl: './hive.html',
  styleUrl: './hive.scss',
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[style.--w]': 'width()',
    '[style.--h]': 'height()',
  },
})
export class Hive {
  readonly cells = input.required<readonly HiveCell[]>();
  readonly label = input.required<string>();

  readonly Kinds = HiveCellKinds;
  readonly Fills = HiveFills;
  readonly path = HEX_PATH;

  private readonly _id = seq++;
  readonly clipId = `mh-hive-clip-${this._id}`;
  readonly honeyId = `mh-hive-honey-${this._id}`;
  readonly clipUrl = `url(#${this.clipId})`;
  readonly honeyUrl = `url(#${this.honeyId})`;

  readonly width = computed(() => Math.max(0, ...this.cells().map((cell) => cell.x)) + 1);
  readonly height = computed(() => Math.max(0, ...this.cells().map((cell) => cell.y)) + HEX_HEIGHT);
}
