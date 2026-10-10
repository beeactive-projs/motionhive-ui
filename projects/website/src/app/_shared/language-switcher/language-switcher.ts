import { Component, computed, signal, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { LineIcon } from '../ui/line-icon/line-icon';

const EN = { code: 'en', label: 'EN' } as const;
const RO = { code: 'ro', label: 'RO' } as const;

type LocaleCode = (typeof EN | typeof RO)['code'];

/**
 * Language switch. `inline` is the EN | RO text toggle in the desktop header;
 * `segmented` is the RO / EN pill pair in the mobile menu (the menu design
 * lists Romanian first); `compact` is the globe + current code button in the
 * mobile header bar, which flips to the other language.
 */
@Component({
  selector: 'mh-language-switcher',
  imports: [LineIcon],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss',
})
export class LanguageSwitcher {
  private readonly _document = inject(DOCUMENT);

  readonly variant = input<'inline' | 'segmented' | 'compact'>('inline');

  readonly locales = computed(() => (this.variant() === 'segmented' ? [RO, EN] : [EN, RO]));

  /** Detected from the <html lang="…"> attribute Angular sets per locale build. */
  readonly currentLocale = signal<LocaleCode>(
    (this._document.documentElement.lang as LocaleCode) || 'en'
  );

  protected readonly currentLabel = computed(() => (this.currentLocale() === 'ro' ? RO : EN).label);
  protected readonly otherLocale = computed<LocaleCode>(() =>
    this.currentLocale() === 'ro' ? 'en' : 'ro'
  );
  protected readonly changeLabel = $localize`:@@langSwitcher.change:Change language`;

  switchLocale(code: LocaleCode): void {
    if (code === this.currentLocale()) return;

    // Remember the explicit choice so the geo middleware never overrides it.
    // Matches the cookie the edge middleware reads (`mh_lang`).
    this._document.cookie = `mh_lang=${code}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    const path = this._document.location.pathname;
    // Strip any existing locale prefix (/en/ or /ro/)
    const basePath = path.replace(/^\/(en|ro)(\/|$)/, '/') || '/';

    this._document.location.href = code === 'en' ? basePath : '/ro' + basePath;
  }
}
