import { STORAGE_KEYS } from '../constants/storage-keys.const';
import {
  DEFAULT_LANGUAGE,
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
 * Device choice → browser preference → English. Synchronous, so it can run
 * before bootstrap to pick `LOCALE_ID` and the first translation file.
 */
export function resolveInitialLanguage(): AppLanguage {
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
