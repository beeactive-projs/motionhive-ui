import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-row-skeleton.html',
  styleUrl: './time-row-skeleton.scss',
})
export class TimeRowSkeleton {
  readonly tone = input<'honey' | 'teal' | 'navy' | 'coral' | 'none'>('none');
}
