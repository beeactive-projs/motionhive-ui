import { appLocale } from '../i18n/app-language';

/**
 * The first letter up, the rest as written: for a date or a name that `Intl`
 * hands back in running-text case ("miercuri, 28 octombrie" in Romanian)
 * and that is about to stand alone as a label, which is always sentence
 * case. Never lowers anything, so "MotionHive" and "1RM" survive.
 */
export function sentenceCase(text: string, locale: string = appLocale()): string {
  return text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text;
}

/**
 * The first letter down: a label ("Today", "Azi") going into the middle of a
 * sentence. Only for words a translation capitalised as labels; a proper noun
 * or an English weekday must not come through here.
 */
export function inSentenceCase(text: string, locale: string = appLocale()): string {
  return text ? text.charAt(0).toLocaleLowerCase(locale) + text.slice(1) : text;
}
