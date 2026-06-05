import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from 'primeng/card';

/**
 * `mh-kpi-card` — small metric card used in dashboard / list KPI strips.
 *
 * Stacked label / value / sub layout matching the payments KPI strip:
 * uppercase muted label, big tabular-nums value, optional muted sub.
 *
 * `variant`:
 *   - `default` — neutral card.
 *   - `warn` — danger border + tint + red value; signals "needs attention".
 *
 * No state, no HTTP. Used by the sessions list and adoptable by the
 * payments dashboard, analytics, instructor home.
 */
@Component({
  selector: 'mh-kpi-card',
  imports: [Card],
  templateUrl: './kpi-card.html',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string>();
  /** PrimeIcons class, e.g. 'pi pi-calendar'. */
  readonly icon = input<string>();
  readonly variant = input<'default' | 'warn'>('default');
}
