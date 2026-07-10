import { ChangeDetectionStrategy, Component, LOCALE_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mh-privacy-policy',
  imports: [RouterLink, ButtonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPolicyComponent {
  /**
   * This policy is a single legal document, not a wall of UI strings, so we
   * ship a full English and a full Romanian version and pick one by build
   * locale (localize: ['ro'] → LOCALE_ID 'ro') rather than tagging ~120
   * fragments with i18n. Keeps each legal text readable and reviewable.
   */
  readonly isRo = inject(LOCALE_ID).toLowerCase().startsWith('ro');
  readonly lastUpdated = signal(this.isRo ? '24 iunie 2026' : 'June 24, 2026');

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
