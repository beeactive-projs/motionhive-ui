import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import type { PublicInstructorProfile } from 'core';

interface StatCell {
  value: string;
  label: string;
  visible: boolean;
}

/**
 * The 5-up stat strip below the hero. v1 ships only the cells that
 * have real data — rating, total reviews, years of experience — so we
 * don't render zero-value cells the user can't fill in yet.
 */
@Component({
  selector: 'mh-stat-strip',
  imports: [Card],
  templateUrl: './stat-strip.html',
  styleUrl: './stat-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatStrip {
  readonly profile = input.required<PublicInstructorProfile>();

  readonly cells = computed<StatCell[]>(() => {
    const p = this.profile();
    const rating = p.rating;
    const cells: StatCell[] = [
      {
        value: rating ? rating.average.toFixed(1) : '—',
        label: 'Rating',
        visible: !!rating,
      },
      {
        value: rating ? String(rating.total) : '0',
        label: rating && rating.total === 1 ? 'Review' : 'Reviews',
        visible: !!rating,
      },
      {
        value:
          p.yearsOfExperience != null && p.yearsOfExperience > 0
            ? String(p.yearsOfExperience)
            : '—',
        label: 'Years',
        visible: p.yearsOfExperience != null && p.yearsOfExperience > 0,
      },
    ];
    return cells.filter((c) => c.visible);
  });
}
