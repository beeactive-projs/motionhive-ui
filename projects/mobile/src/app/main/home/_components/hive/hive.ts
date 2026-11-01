import { Component, computed, effect, ElementRef, input, viewChildren } from '@angular/core';

import { HEX_PATH } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { prefersReducedMotion } from '../../../../_shared/utils/motion';
import { buildFrames, HEX_HEIGHT, HIVE_BUILD, HiveCell, HiveCellKinds, HiveFills } from '../../home.config';

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
 * `building` is the first load's comb (`buildingCells()`): empty cells that
 * light with a softly glowing honey one after another, hold lit, and go
 * out as one, in a loop (`buildFrames`), while the data is on its way.
 * Reduced motion leaves them as still, empty cells.
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
    '[class.building]': 'building()',
    '[style.--w]': 'width()',
    '[style.--h]': 'height()',
  },
})
export class Hive {
  readonly cells = input.required<readonly HiveCell[]>();
  readonly label = input.required<string>();
  readonly building = input(false);

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

  private readonly _glows = viewChildren<ElementRef<SVGPathElement>>('glow');

  constructor() {
    // The build runs on the Web Animations API: each cell has its own
    // keyframes (it lights at its turn, all go out together), which one CSS
    // keyframe set shared by every cell cannot say. A level is how far the
    // honey has grown from the cell's centre.
    effect((onCleanup) => {
      const glows = this._glows().map((glow) => glow.nativeElement);
      if (!this.building() || prefersReducedMotion()) return;
      if (!glows.length || typeof glows[0]!.animate !== 'function') return;
      const running = glows.map((glow, i) =>
        glow.animate(
          buildFrames(i).map(({ offset, level }) => ({
            offset,
            transform: `scale(${level})`,
            easing: 'ease-in-out',
          })),
          { duration: HIVE_BUILD.loopMs, iterations: Infinity },
        ),
      );
      onCleanup(() => running.forEach((animation) => animation.cancel()));
    });
  }
}
