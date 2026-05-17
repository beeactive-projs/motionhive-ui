import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

/**
 * `mh-kpi-card` — small metric card used in dashboard / list KPI strips.
 *
 * `variant`:
 *   - `default` — neutral card.
 *   - `warn` — coral border tint; signals "needs attention".
 *
 * No state, no HTTP. Used by sessions list (4 cards) and immediately
 * adoptable by payments dashboard, analytics, instructor home.
 */
@Component({
  selector: 'mh-kpi-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="mh-kpi"
      [class.mh-kpi--warn]="variant === 'warn'"
      [attr.aria-label]="label"
    >
      @if (icon) {
        <span class="mh-kpi__icon" [class]="icon" aria-hidden="true"></span>
      }
      <div class="mh-kpi__text">
        <span class="mh-kpi__label">{{ label }}</span>
        <span class="mh-kpi__value">{{ value }}</span>
        @if (sub) {
          <span class="mh-kpi__sub">{{ sub }}</span>
        }
      </div>
    </article>
  `,
  styles: `
    .mh-kpi {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 12px;
      min-width: 0;
    }
    .mh-kpi--warn {
      border-color: #ff6f61;
      background: #fff7f5;
    }
    .mh-kpi__icon {
      flex: 0 0 38px;
      height: 38px;
      width: 38px;
      border-radius: 10px;
      background: var(--p-primary-50);
      color: var(--p-primary-700);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .mh-kpi__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mh-kpi__label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .mh-kpi__value {
      font-size: 22px;
      font-weight: 700;
      color: var(--p-text-color);
      margin-top: 2px;
    }
    .mh-kpi__sub {
      font-size: 12px;
      color: var(--p-text-muted-color);
      margin-top: 2px;
    }
  `,
})
export class KpiCard {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() sub?: string;
  @Input() icon?: string; // PrimeIcons class, e.g. 'pi pi-calendar'
  @Input() variant: 'default' | 'warn' = 'default';
}
