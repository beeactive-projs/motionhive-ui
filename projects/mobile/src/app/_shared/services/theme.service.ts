import { DOCUMENT, Service, computed, effect, inject, signal } from '@angular/core';
import { Style, StatusBar } from '@capacitor/status-bar';

export const ThemePreferences = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const;

export type ThemePreference = (typeof ThemePreferences)[keyof typeof ThemePreferences];

const THEME_STORAGE_KEY = 'mh-mobile-theme';

/**
 * Mobile-only theme handling built on Ionic's class-driven dark palette
 * (`ion-palette-dark` on <html>). Deliberately independent from core's
 * ThemeService, which drives web's `.dark`/PrimeNG mechanism.
 */
@Service()
export class ThemeService {
  private readonly _document = inject(DOCUMENT);
  private readonly _systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly _systemDark = signal(this._systemDarkQuery.matches);
  /** A screen with a navy top (the workout summary) needs light status icons in light mode too. */
  private readonly _darkTop = signal(false);

  readonly preference = signal<ThemePreference>(readStoredPreference());
  readonly isDark = computed(
    () =>
      this.preference() === ThemePreferences.Dark ||
      (this.preference() === ThemePreferences.System && this._systemDark()),
  );

  constructor() {
    this._systemDarkQuery.addEventListener('change', (event) => this._systemDark.set(event.matches));
    effect(() => {
      const isDark = this.isDark();
      this._document.documentElement.classList.toggle('ion-palette-dark', isDark);
      // The status bar sits outside the WebView, so the palette class cannot
      // reach it — switching to dark in-app otherwise leaves black icons on a
      // navy toolbar. `Style.Dark` means "light content", i.e. for a dark bar.
      const darkBar = isDark || this._darkTop();
      void StatusBar.setStyle({ style: darkBar ? Style.Dark : Style.Light }).catch(() => {
        // Not a native platform.
      });
    });
  }

  /** On while a screen with a navy top is showing; off again on leaving it. */
  setDarkTop(on: boolean): void {
    this._darkTop.set(on);
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const known = Object.values(ThemePreferences) as string[];
  return stored !== null && known.includes(stored)
    ? (stored as ThemePreference)
    : ThemePreferences.Light;
}
