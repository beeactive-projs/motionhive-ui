import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * `mh-day-separator` — sticky day header used between groups in any
 * vertically-scrolling agenda. Pairs with `mh-time-row`.
 *
 * Visual: translucent blurred bg · 10px uppercase label · optional count
 * + status (e.g. "· 4 sessions · in 18 min" or "· 1 conflict" coral).
 *
 * Inputs:
 *   - `label`   — e.g. "Today · Thu 21 May" or "Fri 22 May"
 *   - `count`   — sessions in this group
 *   - `note`    — small note text (e.g. "in 18 min", "1 conflict")
 *   - `tone`    — accent: 'today' (honey label), 'conflict' (coral), 'default'
 *   - `sticky`  — defaults true; pass false when used inline
 */
@Component({
  selector: 'mh-day-separator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-ds"
      [class.mh-ds--today]="tone() === 'today'"
      [class.mh-ds--conflict]="tone() === 'conflict'"
      [class.mh-ds--sticky]="sticky()"
      role="heading"
      aria-level="2"
    >
      <span class="mh-ds__label">{{ label() }}</span>
      @if (count() != null) {
        <span class="mh-ds__count">· {{ count() }} {{ count() === 1 ? 'session' : 'sessions' }}</span>
      }
      @if (note()) {
        <span class="mh-ds__note">· {{ note() }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .mh-ds {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 10px 0 6px;
      font-size: 10px;
      font-weight: 700;
      color: var(--p-text-muted-color);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .mh-ds--sticky {
      position: sticky;
      top: 0;
      z-index: 1;
      background: color-mix(in srgb, var(--p-content-background) 92%, transparent);
      backdrop-filter: blur(8px);
    }
    .mh-ds--today .mh-ds__label { color: var(--p-primary-700); }
    .mh-ds--conflict .mh-ds__label,
    .mh-ds--conflict .mh-ds__note { color: var(--p-red-500, #F97066); }
    .mh-ds__count {
      font-weight: 500;
      color: var(--p-surface-400, #B0A998);
      text-transform: none;
      letter-spacing: 0;
    }
    .mh-ds__note {
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class DaySeparator {
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
  readonly note = input<string>('');
  readonly tone = input<'default' | 'today' | 'conflict'>('default');
  readonly sticky = input(true);
}
