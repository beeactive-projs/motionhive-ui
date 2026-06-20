import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-separator.html',
  styleUrl: './day-separator.scss',
})
export class DaySeparator {
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
  readonly note = input<string>('');
  readonly tone = input<'default' | 'today' | 'conflict'>('default');
  readonly sticky = input(true);
}
