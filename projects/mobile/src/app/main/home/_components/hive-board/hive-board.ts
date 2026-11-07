import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophy } from 'ionicons/icons';

import {
  APP_HEX_SHAPE,
  HexShape,
  cellFigure,
} from '../../../../_shared/config/hexagon.config';
import { initialsOf } from '../../home.config';
import {
  BoardCell,
  BoardLooks,
  avatarFill,
  avatarInk,
  boardLayout,
} from './hive-board.config';

/** Gradient and clip ids are document-wide, so every instance needs its own. */
let seq = 0;

// Every figure is centred on (50, 50) in both shapes (`HexFigure`), so
// these scale it about its own centre.
/** Where the hexagon sits inside its box: a sliver of the page around it. */
const CELL_SCALE = 'translate(50 50) scale(0.92) translate(-50 -50)';
/** A person inside a cell's honey band. */
const INSET = 'translate(50 50) scale(0.68) translate(-50 -50)';
/** A ring just outside the hexagon, in the sliver between neighbours. */
const RING = 'translate(50 50) scale(0.985) translate(-50 -50)';

/**
 * A honeycomb you can tap: the coach's clients around them, a trainee's
 * month, a client's week.
 *
 * Draws a hexagon on its point (`cellFigure`: the app's unless `shape`
 * says otherwise), as the Home hive does, at the places
 * `hive-board.config.ts` computes and with the row step `boardLayout` gives
 * for that shape. A cell with a `name` is an `ion-button`; the rest are pictures,
 * hidden from a screen reader. A cell can hold honey rising from the
 * bottom, a person (their photo, or their initials in their avatar tone,
 * as `mh-hex-avatar` draws them), a photo filling it, a day's number, a
 * ring and a record's trophy.
 *
 * The comb sizes its cells from its own width, between `--cell-min` and
 * `--cell-max` (set by the page), and scrolls sideways inside itself when
 * even the smallest cells do not fit. The hexagon is the tap target: the
 * box around it overlaps its neighbours' at the corners, so the button
 * takes taps through its shape only.
 */
@Component({
  selector: 'mh-hive-board',
  imports: [IonButton, IonIcon, NgTemplateOutlet],
  templateUrl: './hive-board.html',
  styleUrl: './hive-board.scss',
  host: {
    '[attr.role]': 'interactive() ? "group" : "img"',
    '[attr.aria-label]': 'label()',
    '[class.loading]': 'loading()',
  },
})
export class HiveBoard {
  readonly cells = input.required<readonly BoardCell[]>();
  /** What the board shows, for a screen reader. */
  readonly label = input.required<string>();
  /** Column heads over the first row (the weekday letters), one per column. */
  readonly headers = input<readonly string[]>([]);
  /** The cell whose sheet is open. */
  readonly selected = input<string | null>(null);
  /** Ghost cells breathing while the data is on its way. */
  readonly loading = input(false);

  readonly select = output<string>();

  /** Classic, the app's hexagon; `logo` for the brand's own. */
  readonly shape = input<HexShape>(APP_HEX_SHAPE);

  constructor() {
    // The record's trophy; the board is on three screens, so it brings its own.
    addIcons({ trophy });
  }

  readonly Looks = BoardLooks;
  readonly hex = computed(() => cellFigure(this.shape()));
  readonly cellScale = CELL_SCALE;
  readonly inset = INSET;
  readonly ring = RING;
  readonly fill = avatarFill;
  readonly ink = avatarInk;
  readonly initials = initialsOf;

  private readonly _id = seq++;
  readonly clipId = `mh-board-clip-${this._id}`;
  readonly honeyId = `mh-board-honey-${this._id}`;
  readonly clipUrl = `url(#${this.clipId})`;
  readonly honeyUrl = `url(#${this.honeyId})`;

  readonly layout = computed(() => boardLayout(this.cells(), this.shape()));
  readonly interactive = computed(() => this.cells().some((cell) => !!cell.name));
}
