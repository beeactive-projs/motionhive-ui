/**
 * Address validation shared by every screen that takes one.
 *
 * Deliberately tracks class-validator's `@IsEmail()` on the BE's DTOs rather
 * than sitting looser than it: a check that enables Send on an address the BE
 * then rejects turns a typo into a round trip and a toast. It lives in core so
 * the web app and the mobile app cannot drift from each other or from the DTO.
 */

/**
 * RFC 5321's ceiling on an address, and on its local part. The first is also
 * the `maxlength` on the fields that take one, so an input cannot hold
 * something the BE will always refuse.
 */
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;

/**
 * Dot-separated atoms, never doubled and never at an edge. The punctuation is
 * RFC 5322's atext set, which is wide — but it excludes the characters that
 * let `<script>@x.com` through before.
 */
const EMAIL_LOCAL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

/**
 * Labels that start and end alphanumeric, and a TLD of at least two letters.
 * Rejects the empty label in `b..c` and the leading hyphen in `-b.com`.
 */
const EMAIL_DOMAIN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Enough to stop a typo, not a full RFC 5322 parse. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;

  const at = email.lastIndexOf('@');
  if (at < 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) return false;

  return EMAIL_LOCAL.test(local) && EMAIL_DOMAIN.test(domain);
}

/**
 * What to say under the field, or null when there is nothing to say. Empty is
 * not an error — a field nobody has filled in yet has not gone wrong, and the
 * submit is disabled anyway.
 */
export function emailErrorMessage(value: string): string | null {
  const email = value.trim();
  if (!email) return null;
  if (email.length > EMAIL_MAX_LENGTH) {
    return `An email address cannot be longer than ${EMAIL_MAX_LENGTH} characters.`;
  }
  return isValidEmail(email) ? null : 'Enter a valid email address, like client@example.com.';
}
