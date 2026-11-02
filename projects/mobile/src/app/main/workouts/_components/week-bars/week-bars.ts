import { Component, computed, input, output } from '@angular/core';

import { barHeights } from '../../volume.config';

/** One week's bar: its height comes from the values, the rest from the host. */
export interface WeekBar {
  key: string;
  value: number;
  /** Under the bar, or empty: a label every few weeks is enough. */
  tick: string;
  /** What the bar says, for a screen reader: "Week of 26 Oct: 3 workouts". */
  label: string;
}

/**
 * The weeks as bars you can tap. No chart library: a row of buttons, each a
 * bar drawn to its share of the tallest week. The picked week is honey (it
 * is the selection); the others stay neutral, since a bar's height is
 * already the news.
 */
@Component({
  selector: 'mh-week-bars',
  templateUrl: './week-bars.html',
  styleUrl: './week-bars.scss',
})
export class WeekBars {
  readonly bars = input.required<WeekBar[]>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();

  readonly shown = computed(() => {
    const bars = this.bars();
    const heights = barHeights(bars.map((bar) => bar.value));
    return bars.map((bar, i) => ({ ...bar, height: heights[i] }));
  });

  pick(key: string): void {
    this.picked.emit(key);
  }
}
