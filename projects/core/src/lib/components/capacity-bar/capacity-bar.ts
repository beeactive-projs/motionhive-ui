import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

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
 *
 * Domain-agnostic: no session-domain imports.
 */
@Component({
  selector: 'mh-capacity-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cap == null) {
      <div class="mh-capacity mh-capacity--uncapped">
        <span class="mh-capacity__label">{{ signups }} going · no capacity limit</span>
      </div>
    } @else {
      <div class="mh-capacity">
        <div class="mh-capacity__bar" [attr.aria-valuenow]="signups" [attr.aria-valuemax]="cap" role="progressbar">
          <div
            class="mh-capacity__fill"
            [class.mh-capacity__fill--hot]="signups / cap > 0.75"
            [class.mh-capacity__fill--full]="signups >= cap"
            [style.width.%]="fillPct()"
          ></div>
        </div>
        <span class="mh-capacity__label">
          <strong>{{ signups }}</strong> / {{ cap }}
          @if (spotsLeft() <= 3 && spotsLeft() > 0) {
            <span class="mh-capacity__hot">· {{ spotsLeft() }} spot{{ spotsLeft() === 1 ? '' : 's' }} left</span>
          }
          @if (signups >= cap) {
            <span class="mh-capacity__hot">· full</span>
          }
        </span>
      </div>
    }
  `,
  styles: `
    .mh-capacity {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--p-text-muted-color);
    }
    .mh-capacity--uncapped .mh-capacity__label { color: var(--p-text-muted-color); }

    .mh-capacity__bar {
      position: relative;
      width: 80px;
      height: 6px;
      background: var(--p-surface-200);
      border-radius: 999px;
      overflow: hidden;
    }
    .mh-capacity__fill {
      height: 100%;
      background: var(--p-primary-500);
      border-radius: 999px;
      transition: width 200ms ease;
    }
    .mh-capacity__fill--hot  { background: #F97316; }
    .mh-capacity__fill--full { background: #FF6F61; }

    .mh-capacity__label strong { color: var(--p-text-color); }
    .mh-capacity__hot { color: #FF6F61; font-weight: 600; margin-left: 4px; }
  `,
})
export class CapacityBar {
  @Input({ required: true }) signups!: number;
  @Input() cap: number | null = null;

  protected fillPct(): number {
    if (this.cap == null || this.cap === 0) return 0;
    return Math.min(100, (this.signups / this.cap) * 100);
  }

  protected spotsLeft(): number {
    if (this.cap == null) return Infinity;
    return Math.max(0, this.cap - this.signups);
  }
}
