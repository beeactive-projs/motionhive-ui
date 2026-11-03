import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

import { barHeights } from '../../volume.config';

/** One bar: its height comes from the values, the rest from the host. */
export interface ChartBar {
  key: string;
  value: number;
  /** Under the bar, or empty: a label every few bars is enough. */
  tick: string;
  /** What the bar says, for a screen reader: "Week of 26 Oct: 3 workouts". */
  label: string;
  /** Written above the bar while it is the selected one ("4.3 t"), or empty. */
  top?: string;
}

/** How close to an end a bar's figure lines up with that end, not the bar's middle. */
const EDGE_BARS = 2;

/**
 * Bars standing on a line, rounded at both ends: the weeks on Progress, the
 * sessions on an exercise's page. No chart library: a row of columns, each
 * bar drawn to its share of the tallest. The selected bar is honey (it is
 * the selection) with its figure on top; the others stay neutral, since a
 * bar's height is already the news.
 *
 * `interactive`: each column is a button that picks its bar (Progress). Off,
 * the row is one picture with `label` for a screen reader.
 */
@Component({
  selector: 'mh-bar-chart',
  imports: [NgTemplateOutlet],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChart {
  readonly bars = input.required<ChartBar[]>();
  readonly selected = input<string | null>(null);
  readonly interactive = input(true);
  /** The whole chart, for a screen reader, when the bars are not buttons. */
  readonly label = input('');
  readonly picked = output<string>();

  readonly shown = computed(() => {
    const bars = this.bars();
    const heights = barHeights(bars.map((bar) => bar.value));
    const selected = this.selected();
    return bars.map((bar, i) => ({
      ...bar,
      height: heights[i],
      top: bar.key === selected ? (bar.top ?? '') : '',
      edge: i < EDGE_BARS ? 'start' : i >= bars.length - EDGE_BARS ? 'end' : 'middle',
    }));
  });

  /** Room above the bars for the selected one's figure. */
  readonly hasTop = computed(() => this.shown().some((bar) => bar.top));

  pick(key: string): void {
    this.picked.emit(key);
  }
}
