import { TranslateService } from '@ngx-translate/core';
import { monthNames, weekdayNames } from 'core';
import { Translation } from 'primeng/api';

/** The PrimeNG strings the app's JSON carries, under `primeng.*`. */
const PRIMENG_KEYS = [
  'accept',
  'apply',
  'cancel',
  'choose',
  'clear',
  'emptyFilterMessage',
  'emptyMessage',
  'emptySearchMessage',
  'medium',
  'passwordPrompt',
  'reject',
  'strong',
  'today',
  'upload',
  'weak',
  'weekHeader',
] as const satisfies readonly (keyof Translation)[];

/**
 * PrimeNG's locale for the current UI language — datepicker day/month names,
 * filter/empty messages, password meter.
 *
 * Day and month names come from `Intl` rather than the JSON: they're arrays,
 * which the ICU compiler can't hold, and the browser already knows them in
 * every locale. Weeks start on Monday, as they do everywhere else in the app.
 */
export function primeNgTranslation(translateService: TranslateService): Translation {
  const translation: Translation = {};
  for (const key of PRIMENG_KEYS) {
    translation[key] = translateService.instant(`primeng.${key}`);
  }

  // PrimeNG's day arrays run Sunday-first; weekdayNames() is Monday-first.
  const sundayFirst = (names: string[]) => [names[6], ...names.slice(0, 6)];
  return {
    ...translation,
    dayNames: sundayFirst(weekdayNames('long')),
    dayNamesShort: sundayFirst(weekdayNames('short')),
    dayNamesMin: sundayFirst(weekdayNames('narrow')),
    monthNames: monthNames('long'),
    monthNamesShort: monthNames('short'),
    firstDayOfWeek: 1,
  };
}
