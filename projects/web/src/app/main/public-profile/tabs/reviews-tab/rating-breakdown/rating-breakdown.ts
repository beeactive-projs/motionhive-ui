import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ReviewBreakdown } from 'core';

/**
 * Big number + total + 5 horizontal bars. Implemented as a table for
 * SR users (each row = star bucket); CSS makes it look like bars.
 */
@Component({
  selector: 'mh-rating-breakdown',
  imports: [],
  templateUrl: './rating-breakdown.html',
  styleUrl: './rating-breakdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingBreakdown {
  readonly breakdown = input.required<ReviewBreakdown>();
}
