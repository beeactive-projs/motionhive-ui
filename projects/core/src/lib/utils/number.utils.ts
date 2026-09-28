import { appLocale } from '../i18n/app-language';

/** The UI locale's decimal mark: "." in English, "," in Romanian. */
export function decimalSeparator(): string {
  const parts = new Intl.NumberFormat(appLocale()).formatToParts(1.5);
  return parts.find((part) => part.type === 'decimal')?.value ?? '.';
}

/**
 * A number being typed, held as a plain string ("82.5"), shown with the UI
 * locale's decimal mark ("82,5"). No grouping and no rounding, and a trailing
 * mark survives ("82." → "82,"), so it can echo input as it is typed.
 */
export function localizeTypedNumber(raw: string): string {
  return raw.replace('.', decimalSeparator());
}
