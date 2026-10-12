import { Component, inject, signal } from '@angular/core';
import { IonButton, IonButtons, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { globeOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { AppLanguage, LanguageService } from 'core';

import { ThemePreferences, ThemeService } from '../../services/theme.service';

/**
 * The language and theme buttons for screens shown before sign-in (the auth
 * pages), where the account settings that hold them aren't reachable yet.
 * Mirrors the web app's site header: a globe with the current code that flips
 * to the other language (reloading, see LanguageService), and a sun/moon that
 * pins the opposite of what's showing. Place it in a toolbar: `slot="end"`.
 */
@Component({
  selector: 'mh-guest-controls',
  imports: [IonButton, IonButtons, IonIcon, TranslatePipe],
  templateUrl: './guest-controls.html',
})
export class GuestControls {
  private readonly _languageService = inject(LanguageService);
  private readonly _themeService = inject(ThemeService);

  protected readonly current = this._languageService.current;
  /** Where the language button goes: the language after the current one. */
  private readonly _next: AppLanguage = this._languageService.languages[
    (this._languageService.languages.indexOf(this.current) + 1) %
      this._languageService.languages.length
  ];
  /** Set on the first tap, so repeat taps don't queue more reloads. */
  protected readonly switching = signal(false);
  protected readonly isDark = this._themeService.isDark;

  constructor() {
    addIcons({ globeOutline, moonOutline, sunnyOutline });
  }

  protected switchLanguage(): void {
    this.switching.set(true);
    this._languageService.use(this._next);
  }

  protected toggleTheme(): void {
    this._themeService.setPreference(this.isDark() ? ThemePreferences.Light : ThemePreferences.Dark);
  }
}
