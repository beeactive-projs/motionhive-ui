import { isSupportedLanguage } from '../constants/languages.const';
import { appLocale } from './app-language';
import { translate } from './translator';

/**
 * Display name for a language code stored on a profile (`User.language`):
 * `'ro'` → "Română".
 *
 * The UI languages use the shared `language.<code>` keys (each written in its
 * own language). Any other code the API holds is named in the UI language via
 * `Intl.DisplayNames`, falling back to the raw code.
 */
export function languageName(code: string | null | undefined): string {
  if (!code) return '';
  if (isSupportedLanguage(code)) return translate(`language.${code}`);
  try {
    const name = new Intl.DisplayNames([appLocale()], { type: 'language' }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(appLocale()) + name.slice(1) : code;
  } catch {
    return code;
  }
}
