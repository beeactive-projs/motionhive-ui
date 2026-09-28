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
