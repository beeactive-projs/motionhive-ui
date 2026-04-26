import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

/**
 * One row in the "honest roadmap" section. The "when" is rendered as a
 * pill on the left ("Now" highlighted in honey, others in surface).
 * Status text on the right (e.g. "Building now") is optional.
 */
@Component({
  selector: 'mh-roadmap-row',
  imports: [TagModule],
  templateUrl: './roadmap-row.html',
  styleUrl: './roadmap-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoadmapRow {
  readonly when = input.required<string>();
  /** Highlights the "when" pill in honey when true (i.e. it's the current "Now" row). */
  readonly active = input<boolean>(false);
  readonly title = input.required<string>();
  readonly sub = input<string | null>(null);
  readonly status = input<string | null>(null);
}
