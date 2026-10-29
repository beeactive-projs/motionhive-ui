import { Component, computed, input } from '@angular/core';

import { TrendPoint, trendGeometry } from '../../workouts.config';

export interface TrendLabel {
  /** Epoch ms. */
  at: number;
  label: string;
  /**
   * Centred on its tick, as a month name over where the month begins. Left
   * out, the first label starts at its tick and the last ends at it.
   */
  align?: 'middle';
}

/**
 * A bare trend line: three gridlines, the line over a soft area, and a dot on
 * the latest value. No tooltips, no scrubbing: it answers "is this going up",
 * and the numbers around it say by how much.
 *
 * The line is drawn in a stretched SVG; the labels and the dot sit in HTML on
 * top, so the text keeps its shape and the dot stays round at any width.
 */
@Component({
  selector: 'mh-trend-chart',
  templateUrl: './trend-chart.html',
  styleUrl: './trend-chart.scss',
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
  },
})
export class TrendChart {
  readonly points = input.required<TrendPoint[]>();
  /** The time span the x axis covers, as epoch ms. */
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly xLabels = input<TrendLabel[]>([]);
  /** What the chart says, for screen readers. */
  readonly label = input('');

  readonly geometry = computed(() => trendGeometry(this.points(), this.from(), this.to()));

  readonly xTicks = computed(() => {
    const span = Math.max(this.to() - this.from(), 1);
    const labels = this.xLabels();
    return labels.map((tick, index) => {
      const left = ((tick.at - this.from()) / span) * 100;
      // A centred label this close to an edge would hang off the card.
      const align = tick.align
        ? left < 8
          ? 'start'
          : left > 92
            ? 'end'
            : 'middle'
        : index === 0
          ? 'start'
          : index === labels.length - 1
            ? 'end'
            : 'middle';
      return { label: tick.label, left, align };
    });
  });
}
