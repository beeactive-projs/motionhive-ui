import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { AppLanguage, LanguageService } from 'core';

/**
 * UI language switch for screens without the profile menu (the auth pages).
 * Mirrors the website header: an EN | RO toggle from `sm` up, and on phones a
 * globe button with the current code that flips to the other language.
 * Switching reloads the page (see LanguageService).
 */
@Component({
  selector: 'mh-language-switcher',
  imports: [ButtonDirective, TranslatePipe],
  templateUrl: './language-switcher.html',
  host: { class: 'flex items-center' },
})
export class LanguageSwitcher {
  private readonly _languageService = inject(LanguageService);

  protected readonly languages = this._languageService.languages;
  protected readonly current = this._languageService.current;
  /** Where the phone button goes: the language after the current one. */
  protected readonly next =
    this.languages[(this.languages.indexOf(this.current) + 1) % this.languages.length];
  /** Set on the first tap, so repeat taps don't queue more reloads. */
  protected readonly switching = signal(false);

  protected use(language: AppLanguage): void {
    if (language === this.current) return;
    this.switching.set(true);
    this._languageService.use(language);
  }
}
