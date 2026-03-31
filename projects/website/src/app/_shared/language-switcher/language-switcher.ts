import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const locales = [
  { code: 'en', label: 'EN' },
  { code: 'ro', label: 'RO' },
] as const;

type LocaleCode = (typeof locales)[number]['code'];

@Component({
  selector: 'mh-language-switcher',
  templateUrl: './language-switcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcher {
  private readonly _document = inject(DOCUMENT);

  readonly locales = locales;

  /** Detected from the <html lang="…"> attribute Angular sets per locale build. */
  readonly currentLocale = signal<LocaleCode>(
    (this._document.documentElement.lang as LocaleCode) || 'en',
  );

  switchLocale(code: LocaleCode): void {
    if (code === this.currentLocale()) return;

    const path = this._document.location.pathname;

    if (code === 'ro') {
      // Navigate to the /ro/ build (baseHref is /ro/ for that build)
      this._document.location.href = '/ro' + path;
    } else {
      // Navigate to the EN build — strip the /ro prefix if present
      const stripped = path.startsWith('/ro') ? path.slice(3) || '/' : path;
      this._document.location.href = stripped;
    }
  }
}
