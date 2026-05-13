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
      <span class="mh-day__line"></span>
      <span class="mh-day__label">{{ label() }}</span>
      <span class="mh-day__line"></span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: 18px 0 14px;
    }
    .mh-day {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mh-day__line {
      flex: 1;
      height: 1px;
      background: rgba(15, 23, 42, 0.08);
    }
    .mh-day__label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    :host-context(.dark) .mh-day__line {
      background: rgba(248, 250, 252, 0.10);
    }
    :host-context(.dark) .mh-day__label {
      color: var(--p-surface-400, #94a3b8);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDivider {
  readonly label = input.required<string>();
}
