import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Standard section header used across the home page. Eyebrow above,
 * H2 title, optional subtitle, and an optional action link on the
 * right (e.g. "See all →", "Read their stories →"). The action emits
 * `actionClick` so call-sites decide what it does — buttons are
 * cosmetic for now since the destinations don't all exist yet.
 */
@Component({
  selector: 'mh-section-header',
  imports: [ButtonModule],
  templateUrl: './section-header.html',
  styleUrl: './section-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeader {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly dense = input<boolean>(false);

  readonly actionClick = output<void>();
}
