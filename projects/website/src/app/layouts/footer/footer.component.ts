import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedbackService, Logo } from 'core';
import { CookieConsentService } from '../../_shared/cookie-consent/cookie-consent.service';
import { LanguageSwitcher } from '../../_shared/language-switcher/language-switcher';
import { LineIcon } from '../../_shared/ui/line-icon/line-icon';

interface FooterLink {
  label: string;
  path: string;
  /** Used where the links run as one wrapping line and space is tight. */
  shortLabel?: string;
}

/**
 * Public marketing footer — always-dark navy (a `.dark` island so it renders
 * the same in both themes and the logo uses its amber-on-dark lockup). The
 * link columns double as the crawlable path to every indexable page (the nav
 * mega-menu is JS-only, so search engines follow these).
 */
@Component({
  selector: 'mh-public-footer',
  imports: [RouterLink, Logo, LanguageSwitcher, LineIcon],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicFooterComponent {
  private readonly _feedback = inject(FeedbackService);
  private readonly _cookie = inject(CookieConsentService);

  readonly currentYear = new Date().getFullYear();

  readonly product: FooterLink[] = [
    { label: $localize`Features`, path: '/features' },
    { label: $localize`Pricing`, path: '/pricing' },
    { label: $localize`Blog`, path: '/blog' },
    { label: $localize`Calorie calculator`, path: '/tools/calorie-calculator' },
  ];

  readonly company: FooterLink[] = [{ label: $localize`About`, path: '/about' }];

  readonly support: FooterLink[] = [
    {
      label: $localize`Terms of Service`,
      shortLabel: $localize`:@@footer.termsShort:Terms`,
      path: '/legal/terms-of-service',
    },
    {
      label: $localize`Privacy Policy`,
      shortLabel: $localize`:@@footer.privacyShort:Privacy`,
      path: '/legal/privacy-policy',
    },
    {
      label: $localize`Delete Your Account`,
      shortLabel: $localize`:@@footer.deleteShort:Delete account`,
      path: '/legal/delete-account',
    },
  ];

  readonly social = [
    { icon: 'pi-facebook', href: 'https://facebook.com/motionhive.fit', label: 'Facebook' },
    { icon: 'pi-instagram', href: 'https://instagram.com/motionhive.fit', label: 'Instagram' },
    { icon: 'pi-linkedin', href: 'https://www.linkedin.com/company/motionhivefit', label: 'LinkedIn' },
  ];

  openFeedback(): void {
    this._feedback.open();
  }

  openCookiePreferences(): void {
    void this._cookie.showPreferences();
  }
}
