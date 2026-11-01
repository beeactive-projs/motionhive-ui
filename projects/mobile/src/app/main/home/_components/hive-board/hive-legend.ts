import { Component, computed, input } from '@angular/core';

import {
  APP_HEX_SHAPE,
  HexShape,
  cellFigure,
} from '../../../../_shared/config/hexagon.config';

export const LegendSwatches = {
  /** A cell full of honey: trained, done. */
  Honey: 'honey',
  /** A cell's empty track: planned, waiting. */
  Track: 'track',
  /** A dashed edge: no plan, skipped. */
  Dashed: 'dashed',
  /** The coral ring: quiet for a week. */
  Quiet: 'quiet',
  /** The honey ring: today. */
  Today: 'today',
  /** A record's dot. */
  Dot: 'dot',
} as const;

export type LegendSwatch = (typeof LegendSwatches)[keyof typeof LegendSwatches];

export interface LegendItem {
  swatch: LegendSwatch;
  /** Translated. */
  label: string;
}

/**
 * The key under a `mh-hive-board`: a small hexagon drawn as the board
 * draws that state, and what it means. One line that wraps whole items.
 * It repeats what the cells' names already say, so a screen reader skips it.
 */
@Component({
  selector: 'mh-hive-legend',
  templateUrl: './hive-legend.html',
  styleUrl: './hive-legend.scss',
  host: { 'aria-hidden': 'true' },
})
export class HiveLegend {
  readonly items = input.required<readonly LegendItem[]>();
  /** The board's shape, so the key's cells match it. */
  readonly shape = input<HexShape>(APP_HEX_SHAPE);

  readonly Swatches = LegendSwatches;
  /** The board's own cell. */
  readonly hex = computed(() => cellFigure(this.shape()));
}
