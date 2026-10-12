import { STORAGE_KEYS } from '../constants/storage-keys.const';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_URL_PARAM,
  LOCALE_BY_LANGUAGE,
  isSupportedLanguage,
} from '../constants/languages.const';
import { AppLanguage } from '../models/common/language.enums';

/**
 * The UI language for this page load, resolved once and then fixed.
 *
 * Fixed on purpose: `LOCALE_ID` is read at bootstrap, and TS-built labels
 * (menus, tab configs) are computed once, so a language change reloads the page
 * rather than trying to re-render every surface in place (see LanguageService).
 */
let _current: AppLanguage | null = null;

/**
 * Link → device choice → browser preference → English. Synchronous, so it can
 * run before bootstrap to pick `LOCALE_ID` and the first translation file.
 */
export function resolveInitialLanguage(): AppLanguage {
  const linked = consumeLinkedLanguage();
  // The language the visitor was just reading in (e.g. the Romanian site's
  // sign-up button) replaces the stored one, but only for a guest. With a
  // session the account's language wins: the stored value already mirrors it,
  // and switching here would render the link's language until sync reloads
  // back. The site's language may also come from IP geo, not a real choice.
  if (linked && !hasSession()) {
    writeStoredLanguage(linked);
    return linked;
  }

  const stored = readStoredLanguage();
  if (stored) return stored;

  const preferred = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function appLanguage(): AppLanguage {
  return (_current ??= resolveInitialLanguage());
}

/** BCP 47 locale for `Intl` / `toLocale*` calls in plain functions. */
export function appLocale(): string {
  return LOCALE_BY_LANGUAGE[appLanguage()];
}

/**
 * Reads `?lang=` off the landing URL and strips it, so the param doesn't stick
 * to the address bar or get re-applied on a later reload. Runs before the
 * router's first navigation, which then sees the cleaned URL.
 */
function consumeLinkedLanguage(): AppLanguage | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LANGUAGE_URL_PARAM)) return null;

  const linked = url.searchParams.get(LANGUAGE_URL_PARAM);
  url.searchParams.delete(LANGUAGE_URL_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return isSupportedLanguage(linked) ? linked : null;
}

/** A refresh token survives an expired access token, so either means signed in. */
function hasSession(): boolean {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) !== null ||
      localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) !== null
    );
  } catch {
    return false;
  }
}

export function readStoredLanguage(): AppLanguage | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    // Storage blocked (private mode, sandboxed iframe) — fall through to the browser.
    return null;
  }
}

export function writeStoredLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  } catch {
    // Storage blocked — the choice still reaches the account when signed in.
  }
}
