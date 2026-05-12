import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { PublicProfileStore } from 'core';
import type { PublicInstructorProfile } from 'core';

/**
 * Sticky bottom action bar visible below `lg`. Mirrors the hero CTAs so
 * the Book / Message actions remain reachable when the rail is hidden.
 */
@Component({
  selector: 'mh-mobile-cta-bar',
  imports: [Button],
  templateUrl: './mobile-cta-bar.html',
  styleUrl: './mobile-cta-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileCtaBar {
  private readonly _store = inject(PublicProfileStore);

  readonly profile = input.required<PublicInstructorProfile>();

  readonly book = output<void>();
  readonly message = output<void>();

  readonly offerings = this._store.offerings;
}
