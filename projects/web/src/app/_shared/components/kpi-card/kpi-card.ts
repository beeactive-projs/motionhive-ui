import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { TagSeverity } from 'core';

/**
 * `mh-kpi-card` — small metric card used in dashboard / list KPI strips.
 *
 * Stacked label / value / sub layout matching the payments KPI strip:
 * uppercase muted label, big tabular-nums value, optional muted sub.
 *
 * `severity` mirrors PrimeNG's `p-button` severities (`TagSeverity`):
 *   - unset / `null` — neutral card with a primary-tinted icon.
 *   - `success` | `info` | `warn` | `danger` — tinted border + value to
 *     signal state (e.g. `danger` for "needs attention").
 *   - `secondary` | `contrast` — neutral border, muted/contrast icon chip.
 *
 * `loading` swaps the label / value / sub (and icon) for skeletons.
 *
 * No HTTP. Used by the sessions list and adoptable by the payments
 * dashboard, analytics, instructor home.
 */
@Component({
  selector: 'mh-kpi-card',
  imports: [Card, Skeleton],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string>();
  /** PrimeIcons class, e.g. 'pi pi-calendar'. */
  readonly icon = input<string>();
  /** PrimeNG-style severity — same set as `p-button`. */
  readonly severity = input<TagSeverity>();
  /** Swaps content for skeletons while data loads. */
  readonly loading = input(false);

  protected readonly cardClass = computed(() => {
    const s = this.severity();
    return s ? CARD_CLASS[s] : 'border border-surface';
  });
  protected readonly iconClass = computed(() => {
    const s = this.severity();
    // Neutral (unset) cards use a neutral surface chip — honey/primary is
    // reserved for actions, not for stat-card decoration.
    return s ? ICON_CLASS[s] : 'bg-primary-100 text-primary-600 dark:bg-surface-700 dark:text-surface-300';
  });
  protected readonly valueClass = computed(() => {
    const s = this.severity();
    return s ? VALUE_CLASS[s] : '';
  });
}

type SeverityKey = NonNullable<TagSeverity>;

const CARD_CLASS: Record<SeverityKey, string> = {
  success: 'shadow-md border border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10',
  info: 'shadow-md border border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10',
  warn: 'shadow-md border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10',
  danger: 'shadow-md border border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10',
  secondary: 'border border-surface',
  contrast: 'border border-surface',
};

const ICON_CLASS: Record<SeverityKey, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-500/15',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15',
  danger: 'bg-red-100 text-red-600 dark:bg-red-500/15',
  secondary: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
  contrast: 'bg-surface-900 text-surface-0 dark:bg-surface-0 dark:text-surface-900',
};

const VALUE_CLASS: Record<SeverityKey, string> = {
  success: 'text-green-600',
  info: 'text-blue-600',
  warn: 'text-amber-600',
  danger: 'text-red-500',
  secondary: '',
  contrast: '',
};
