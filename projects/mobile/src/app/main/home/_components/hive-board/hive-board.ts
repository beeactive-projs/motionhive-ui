import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

import { HEX_PATH } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { initialsOf } from '../../home.config';
import {
  BoardCell,
  BoardLooks,
  avatarFill,
  avatarInk,
  boardSize,
} from './hive-board.config';

/** Gradient and clip ids are document-wide, so every instance needs its own. */
let seq = 0;

/** Where the hexagon sits inside its box: a sliver of the page around it. */
const SHAPE = 'translate(50 50) scale(0.92) translate(-50 -50)';
/** A person inside a cell's honey band. */
const INSET = 'translate(50 50) scale(0.68) translate(-50 -50)';
/** A ring just outside the hexagon, in the sliver between neighbours. */
const RING = 'translate(50 50) scale(0.985) translate(-50 -50)';

/**
 * A honeycomb you can tap: the coach's clients around them, a trainee's
 * month, a client's week.
 *
 * Draws the app's own hexagon (`HEX_PATH`, the avatars' shape) stood on its
 * point, as the Home hive does, at the places `hive-board.config.ts`
 * computes. A cell with a `name` is an `ion-button`; the rest are pictures,
 * hidden from a screen reader. A cell can hold honey rising from the
 * bottom, a person (their photo, or their initials in their avatar tone,
 * as `mh-hex-avatar` draws them), a photo filling it, a day's number, a
 * ring and a record's dot.
 *
 * The comb sizes its cells from its own width, between `--cell-min` and
 * `--cell-max` (set by the page), and scrolls sideways inside itself when
 * even the smallest cells do not fit. The hexagon is the tap target: the
 * box around it overlaps its neighbours' at the corners, so the button
 * takes taps through its shape only.
 */
@Component({
  selector: 'mh-hive-board',
  imports: [IonButton, NgTemplateOutlet],
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

  readonly Looks = BoardLooks;
  readonly path = HEX_PATH;
  readonly shape = SHAPE;
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

  readonly size = computed(() => boardSize(this.cells()));
  readonly interactive = computed(() => this.cells().some((cell) => !!cell.name));
}
