import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * `mh-capacity-bar` — visual fill bar with "N / M" label.
 *
 * Inputs:
 *   - `signups` — number of confirmed (and pending) participants
 *   - `cap` — capacity; `null` means uncapped (renders "no limit")
 *
 * Visual:
 *   - Fills proportionally; switches to coral when `signups/cap > 0.75`
 *     and shows "X spots left" hint when ≤ 3 remaining.
 *   - For uncapped sessions: just shows "{signups} going · no capacity limit".
 */
@Component({
  selector: 'mh-capacity-bar',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './capacity-bar.html',
  styleUrl: './capacity-bar.scss',
})
export class CapacityBar {
  readonly signups = input.required<number>();
  readonly cap = input<number | null>(null);

  protected readonly fillPct = computed<number>(() => {
    const cap = this.cap();
    if (cap == null || cap === 0) return 0;
    return Math.min(100, (this.signups() / cap) * 100);
  });

  protected readonly spotsLeft = computed<number>(() => {
    const cap = this.cap();
    if (cap == null) return Infinity;
    return Math.max(0, cap - this.signups());
  });
}
