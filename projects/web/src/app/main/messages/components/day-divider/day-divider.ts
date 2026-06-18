import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Uppercase eyebrow centered between two thin rules — separates message
 * runs by day in the chat thread. Matches design §6.3.
 */
@Component({
  selector: 'mh-day-divider',
  standalone: true,
  template: `
    <div class="mh-day" role="separator">
      <span class="mh-day__label">{{ label() }}</span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: 8px 0 14px;
    }
    .mh-day {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mh-day__label {
      font-size: 11.5px;
      font-weight: 700;
      color: #8b93a3;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      background: #f4eee2;
      padding: 4px 12px;
      border-radius: 999px;
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    :host-context(.dark) .mh-day__label {
      color: var(--p-surface-400, #94a3b8);
      background: rgba(248, 250, 252, 0.06);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDivider {
  readonly label = input.required<string>();
}
