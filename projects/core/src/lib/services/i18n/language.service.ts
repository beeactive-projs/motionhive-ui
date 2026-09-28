import { DOCUMENT, InjectionToken, Service, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize, take } from 'rxjs';

import { STORAGE_KEYS } from '../../constants/storage-keys.const';
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '../../constants/languages.const';
import { appLanguage, writeStoredLanguage } from '../../i18n/app-language';
import { AppLanguage } from '../../models/common/language.enums';
import { User } from '../../models/user/user.model';
import { AuthStore } from '../../stores/auth.store';
import { UserService } from '../user/user.service';

/**
 * Set by `provideAppI18n()`. Apps without runtime translations (admin) share
 * AuthService, and must not have sign-in rewrite the account language or
 * reload the page.
 */
export const LANGUAGE_SYNC_ENABLED = new InjectionToken<boolean>('LANGUAGE_SYNC_ENABLED', {
  factory: () => false,
});

/**
 * The UI language: remembered on the device (so boot needs no network) and on
 * the account (so it follows the user to their other devices).
 *
 * A change reloads the page. `LOCALE_ID` is fixed at bootstrap and TS-built
 * labels are computed once, so re-rendering in place would leave half the app
 * in the old language; the website switches languages by reload too.
 */
@Service()
export class LanguageService {
  private readonly _document = inject(DOCUMENT);
  private readonly _router = inject(Router);
  private readonly _authStore = inject(AuthStore);
  private readonly _userService = inject(UserService);
  private readonly _syncEnabled = inject(LANGUAGE_SYNC_ENABLED);

  /** The language this page load renders in. */
  readonly current: AppLanguage = appLanguage();
  readonly languages = SUPPORTED_LANGUAGES;

  /** Switch the UI language: store it on the device and account, then reload. */
  use(language: AppLanguage): void {
    if (language === this.current) return;
    writeStoredLanguage(language);

    if (!this._authStore.isAuthenticated()) {
      this._reload();
      return;
    }

    // Marked pending until the account has it, so a failed save is retried at
    // the next sign-in instead of the old account value overriding the choice.
    setPendingSync(true);
    this._userService
      .updateMyLanguage(language)
      .pipe(finalize(() => this._reload()))
      .subscribe({ next: () => setPendingSync(false), error: () => undefined });
  }

  /**
   * Reconcile with the account after sign-in or a profile refresh. The account
   * wins — it is how a choice made on another device arrives — unless this
   * device holds a choice the account never received, or the account has none.
   */
  syncFromUser(user: User): void {
    if (!this._syncEnabled) return;
    const account = isSupportedLanguage(user.language) ? user.language : null;

    if (account === null || isPendingSync()) {
      if (account === this.current) {
        setPendingSync(false);
        return;
      }
      this._userService
        .updateMyLanguage(this.current)
        .pipe(take(1))
        .subscribe({ next: () => setPendingSync(false), error: () => undefined });
      return;
    }

    if (account !== this.current) {
      writeStoredLanguage(account);
      this._reloadOutsideAuth();
    }
  }

  /**
   * Sign-in syncs before it navigates away from /auth; reloading then would
   * land back on the login form, so wait for the navigation into the app.
   */
  private _reloadOutsideAuth(): void {
    if (!this._router.url.startsWith('/auth')) {
      this._reload();
      return;
    }
    this._router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => !e.urlAfterRedirects.startsWith('/auth')),
        take(1),
      )
      .subscribe(() => this._reload());
  }

  private _reload(): void {
    this._document.defaultView?.location.reload();
  }
}

function isPendingSync(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC) === '1';
  } catch {
    return false;
  }
}

function setPendingSync(pending: boolean): void {
  try {
    if (pending) localStorage.setItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC, '1');
    else localStorage.removeItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC);
  } catch {
    // Storage blocked — worst case the account value wins at the next sign-in.
  }
}
