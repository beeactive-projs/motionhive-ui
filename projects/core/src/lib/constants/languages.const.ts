import { AppLanguage, AppLanguages } from '../models/common/language.enums';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = Object.values(AppLanguages);

export const DEFAULT_LANGUAGE: AppLanguage = AppLanguages.English;

/**
 * BCP 47 locale per UI language — drives `LOCALE_ID` (DatePipe & co.) and every
 * `Intl` / `toLocale*` call. English maps to en-GB, not en-US: the app already
 * formats 24h times and day-first dates, which is what en-GB produces.
 */
export const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  [AppLanguages.English]: 'en-GB',
  [AppLanguages.Romanian]: 'ro-RO',
};

export function isSupportedLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * The supported language behind a BCP 47 locale: `ro-RO` → `ro`, `en-US` →
 * `en`. For code that only has Angular's `LOCALE_ID` to go on, which is the one
 * thing set by both the apps (from the user's choice) and the marketing site
 * (from the build's locale).
 */
export function languageOfLocale(locale: string): AppLanguage {
  const base = locale.toLowerCase().split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}
