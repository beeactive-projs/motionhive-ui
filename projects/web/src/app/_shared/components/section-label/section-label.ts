import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * `mh-section-label` — day-group header for grouped lists.
 *
 * Example: "Today · Mon 18 May (4)". Used in sessions list, my-sessions,
 * mobile discover, and any future grouped list.
 */
@Component({
  selector: 'mh-section-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-label.html',
  styleUrl: './section-label.scss',
})
export class SectionLabel {
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
}
