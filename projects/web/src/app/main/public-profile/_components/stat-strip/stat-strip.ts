import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from 'primeng/card';
import type { ProfileStat } from 'core';

/**
 * 4-up (or fewer) stat strip rendered below the hero. Generic over
 * `ProfileStat[]` so the parent decides which stats are most credible
 * for the profile (instructor: clients · sessions · rating · reply time;
 * user: workouts · streak · groups · PRs — landing in a later phase).
 *
 * Values are pre-formatted by the parent (`'4.9★'`, `'< 2h'`, `'120+'`)
 * so the strip renders them verbatim.
 */
@Component({
  selector: 'mh-stat-strip',
  imports: [Card],
  templateUrl: './stat-strip.html',
  styleUrl: './stat-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatStrip {
  readonly stats = input.required<readonly ProfileStat[]>();
}
