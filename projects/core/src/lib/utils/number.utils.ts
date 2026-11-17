import { appLocale } from '../i18n/app-language';

/** The UI locale's decimal mark: "." in English, "," in Romanian. */
export function decimalSeparator(): string {
  const parts = new Intl.NumberFormat(appLocale()).formatToParts(1.5);
  return parts.find((part) => part.type === 'decimal')?.value ?? '.';
}

/**
 * A number from the API, where DECIMAL columns arrive as strings ("82.50").
 * Null for null, undefined, an empty string or anything that is not a finite
 * number, so a missing target never reads as 0.
 */
export function decimalToNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A number being typed, held as a plain string ("82.5"), shown with the UI
 * locale's decimal mark ("82,5"). No grouping and no rounding, and a trailing
 * mark survives ("82." → "82,"), so it can echo input as it is typed.
 */
export function localizeTypedNumber(raw: string): string {
  return raw.replace('.', decimalSeparator());
}
