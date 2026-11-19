import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChildren,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import {
  APP_HEX_SHAPE,
  HexShape,
  cellFigure,
} from '../../../../_shared/config/hexagon.config';
import { prefersReducedMotion } from '../../../../_shared/utils/motion';
import {
  buildFrames,
  HIVE_BUILD,
  HiveCell,
  HiveCellKinds,
  HiveFills,
  hiveLayout,
} from '../../home.config';

/** Gradient and clip ids are document-wide, so every instance needs its own. */
let seq = 0;

/**
 * A honeycomb: the coach's hive of clients and the trainee's week.
 *
 * Draws a hexagon on its point (`cellFigure`: the app's unless `shape`
 * says otherwise), at the places `home.config.ts` computes and with
 * the row step `hiveLayout` gives for that shape, so the geometry is tested
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
  imports: [IonIcon],
  templateUrl: './hive.html',
  styleUrl: './hive.scss',
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[class.building]': 'building()',
    '[style.--w]': 'layout().width',
    '[style.--h]': 'layout().height',
    '[style.--row]': 'layout().rowStep',
    '[style.--cell-h]': 'layout().cellHeight',
  },
})
export class Hive {
  readonly cells = input.required<readonly HiveCell[]>();
  readonly label = input.required<string>();
  readonly building = input(false);

  /** Classic, the app's hexagon; `logo` for the brand's own. */
  readonly shape = input<HexShape>(APP_HEX_SHAPE);

  readonly Kinds = HiveCellKinds;
  readonly Fills = HiveFills;
  readonly hex = computed(() => cellFigure(this.shape()));

  private readonly _id = seq++;
  readonly clipId = `mh-hive-clip-${this._id}`;
  readonly honeyId = `mh-hive-honey-${this._id}`;
  readonly clipUrl = `url(#${this.clipId})`;
  readonly honeyUrl = `url(#${this.honeyId})`;

  readonly layout = computed(() => hiveLayout(this.cells(), this.shape()));

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
