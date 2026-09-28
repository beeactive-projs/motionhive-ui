import { appLocale } from '../i18n/app-language';

/**
 * A minor-units amount as a bare number in the UI locale — "49.50" in English,
 * "49,50" in Romanian — for layouts that place the currency code themselves.
 * No thousands grouping, matching the `toFixed(2)` output it replaces.
 *
 * `trimWholeNumbers`: whole amounts drop their decimals ("50", not "50.00"),
 * which is how price chips read.
 */
export function formatMinorUnits(
  cents: number,
  options: { trimWholeNumbers?: boolean } = {},
): string {
  const amount = cents / 100;
  const decimals = options.trimWholeNumbers && Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(appLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(amount);
}
