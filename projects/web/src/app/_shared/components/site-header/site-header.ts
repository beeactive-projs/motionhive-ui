import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService, Logo, marketingSiteUrl } from 'core';
import { LanguageSwitcher } from '../language-switcher/language-switcher';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

/**
 * The marketing site's header bar, for the web app's guest pages (auth,
 * error, the public profile): the logo linking to the site, the language
 * switch and the theme toggle. Projected content (e.g. sign-in buttons) goes
 * at the end, as the site puts its call to action.
 */
@Component({
  selector: 'mh-site-header',
  imports: [TranslatePipe, Logo, LanguageSwitcher, ThemeToggle],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  // The border sits inside the 4.4rem (border-box), so pages can fill
  // `100dvh - 4.4rem` below it without scrolling by the border's 1px.
  host: { class: 'sticky top-0 z-10 block h-[4.4rem] border-b' },
})
export class SiteHeader {
  private readonly _languageService = inject(LanguageService);

  /** The marketing site's home in the language the app is showing. */
  protected readonly homeUrl = marketingSiteUrl('/', this._languageService.current);
}
