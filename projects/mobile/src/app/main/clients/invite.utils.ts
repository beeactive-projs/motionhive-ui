import { SIGNUP_URL } from 'core';

/**
 * The invite sheet's own vocabulary — the two ways in, how long an invitation
 * stands, and where its link lands.
 *
 * Address validation is not here: it lives in core (`email.utils`), because
 * the web invite dialog has to agree with this sheet, and both have to agree
 * with the BE's `@IsEmail()`.
 */

/** The two ways in: someone already on MotionHive, or an address. */
export const InviteModes = {
  Platform: 'platform',
  Email: 'email',
} as const;

export type InviteMode = (typeof InviteModes)[keyof typeof InviteModes];

/**
 * Stated in the sheet's copy; the BE owns the real TTL and sets it to 30 days
 * (`expiresAt` on the created request, and again on every resend). This said
 * 14, so the sheet promised one thing and the Requests row — which renders
 * the server's own `expiresAt` — said another about the same invitation.
 */
export const INVITE_EXPIRY_DAYS = 30;

/**
 * Where an email invite's link lands. Built on the web app's address, never
 * `window.location` — inside the WebView that is `capacitor://localhost`.
 */
export function inviteLink(token: string): string {
  return `${SIGNUP_URL}?token=${encodeURIComponent(token)}`;
}
