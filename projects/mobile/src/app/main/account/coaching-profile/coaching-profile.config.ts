import { ACCOUNT_ICONS } from '../account.config';

/**
 * Every icon the coaching profile renders: the account set. The places list
 * registers its own (`VENUE_ICONS`). `coaching-profile.config.spec.ts`
 * checks the screen's templates against it.
 */
export const COACHING_PROFILE_ICONS = {
  ...ACCOUNT_ICONS,
};

/**
 * A price and how it is billed on one line: "RON 75.00 · One-off", but
 * "RON 200.00 / month", since a per-interval label brings its own slash and
 * a dot before it read "RON 200.00 · / month".
 */
export function priceLine(price: string, billing: string): string {
  const label = billing.trim();
  if (!label) return price;
  return label.startsWith('/') ? `${price} ${label}` : `${price} · ${label}`;
}
