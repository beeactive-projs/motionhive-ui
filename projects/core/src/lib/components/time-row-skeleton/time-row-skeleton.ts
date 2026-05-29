import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * `mh-time-row-skeleton` — placeholder that matches `<mh-time-row>`
 * layout exactly so the swap from loading → real data is a zero-jump
 * transition (design rule 5A).
 *
 * Renders the same 46px time chip + 1fr main column + auto trailing
 * grid with shimmer rectangles. Title shimmer is 2 lines (matches the
 * 2-line clamp on the real row). Meta is one short line.
 *
 * Inputs:
 *   - `tone` — left-edge stripe tint to match the variant the row
 *      will eventually render as. Defaults to 'none' (no stripe).
 *
 * No state, no animation framework — pure CSS keyframe shimmer.
 */
@Component({
  selector: 'mh-time-row-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-trs"
      [class.mh-trs--honey]="tone() === 'honey'"
      [class.mh-trs--teal]="tone() === 'teal'"
      [class.mh-trs--navy]="tone() === 'navy'"
      [class.mh-trs--coral]="tone() === 'coral'"
      aria-hidden="true"
    >
      <div class="mh-trs__time">
        <span class="mh-trs__skel mh-trs__skel--h"></span>
        <span class="mh-trs__skel mh-trs__skel--d"></span>
      </div>
      <div class="mh-trs__main">
        <span class="mh-trs__skel mh-trs__skel--title-1"></span>
        <span class="mh-trs__skel mh-trs__skel--title-2"></span>
        <span class="mh-trs__skel mh-trs__skel--meta"></span>
      </div>
      <span class="mh-trs__skel mh-trs__skel--chev"></span>
    </div>
  `,
  styles: `
    :host { display: block; }

    .mh-trs {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 10px;
    }
    .mh-trs--honey   { border-left: 3px solid var(--p-primary-500); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-trs--teal    { border-left: 3px solid var(--p-teal-500, #14B8A6); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-trs--navy    { border-left: 3px solid var(--p-blue-700, #1D4ED8); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-trs--coral   { border-left: 3px solid var(--p-red-500, #F97066); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }

    .mh-trs__time {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .mh-trs__main {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    /* Shimmer skeleton block. Uses a moving gradient so the wait
       feels "alive" without spawning JS animation timers. */
    .mh-trs__skel {
      display: block;
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--p-surface-100) 0%,
        var(--p-surface-200) 50%,
        var(--p-surface-100) 100%
      );
      background-size: 200% 100%;
      animation: mh-trs-shimmer 1.4s linear infinite;
    }
    .mh-trs__skel--h     { width: 36px; height: 13px; }
    .mh-trs__skel--d     { width: 28px; height: 9px; }
    .mh-trs__skel--title-1 { width: 70%; height: 13px; }
    .mh-trs__skel--title-2 { width: 45%; height: 13px; }
    .mh-trs__skel--meta  { width: 55%; height: 10px; margin-top: 2px; }
    .mh-trs__skel--chev  { width: 12px; height: 12px; border-radius: 50%; }

    @keyframes mh-trs-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `,
})
export class TimeRowSkeleton {
  readonly tone = input<'honey' | 'teal' | 'navy' | 'coral' | 'none'>('none');
}
