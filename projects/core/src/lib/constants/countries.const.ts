/**
 * ISO 3166-1 alpha-2 country codes supported by Stripe Connect
 * Express (kept in sync with the backend list in
 * `src/common/constants/countries.ts`). If the backend list changes,
 * update here too.
 */
export const STRIPE_CONNECT_COUNTRIES: ReadonlyArray<{
  code: string;
  name: string;
}> = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'US', name: 'United States' },
];

const SUPPORTED_SET = new Set(STRIPE_CONNECT_COUNTRIES.map((c) => c.code));

export function isStripeSupportedCountry(code: string | null | undefined): boolean {
  return !!code && SUPPORTED_SET.has(code);
}

export function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return STRIPE_CONNECT_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/**
 * Emoji flag for an ISO 3166-1 alpha-2 country code. Works by mapping
 * each letter to its Regional Indicator Symbol (U+1F1E6–U+1F1FF) —
 * the OS renders the pair as a flag. Zero assets, zero runtime cost.
 */
export function countryFlagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + (upper.charCodeAt(0) - 65),
    0x1f1e6 + (upper.charCodeAt(1) - 65),
  );
}
