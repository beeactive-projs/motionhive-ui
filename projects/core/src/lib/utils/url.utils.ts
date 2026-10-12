import type { ParamMap } from '@angular/router';

/**
 * Canonicalize a URL the user pasted. Designed to be forgiving of
 * common copy-paste shapes:
 *
 *   "zoom.us/j/123"              -> "https://zoom.us/j/123"
 *   "www.zoom.us/j/123"          -> "https://www.zoom.us/j/123"
 *   "http://zoom.us/j/123"       -> "http://zoom.us/j/123" (unchanged)
 *   "HTTPS://zoom.us/j/123"      -> "https://zoom.us/j/123"
 *   "  https://zoom.us/j/123  "  -> "https://zoom.us/j/123"
 *   ""                           -> null
 *
 * Returns `null` when the input can't be coerced into a valid URL
 * (e.g. "zoom", "javascript:alert(1)", garbage text). Only the
 * `http` and `https` protocols are accepted — anything else is
 * rejected, including `javascript:`, `data:`, `file:`.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject dangerous protocols outright before parsing.
  if (/^(?!https?:)[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  // Add https:// if the user didn't type a scheme.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    // Must have at least one "." in the hostname (so "zoom" alone is rejected).
    if (!url.hostname.includes('.')) return null;
    // Lower-case the protocol (URL() lowercases it already, but be explicit).
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Predicate variant — convenient in templates / validators where a
 * boolean is enough. Uses the same rules as `normalizeUrl`.
 */
export function isValidUrl(input: string | null | undefined): boolean {
  return normalizeUrl(input) !== null;
}

/**
 * Guess the meeting provider from a URL's hostname. Accepts a raw
 * URL (gets normalized first) or a partial one like "zoom.us/…".
 * Returns null when the input is missing or the host doesn't match
 * a known provider.
 */
export function detectMeetingProvider(
  input: string | null | undefined,
): 'ZOOM' | 'GOOGLE_MEET' | 'TEAMS' | null {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host.endsWith('zoom.us') || host.endsWith('zoom.com')) return 'ZOOM';
    if (host.endsWith('meet.google.com')) return 'GOOGLE_MEET';
    if (host.endsWith('teams.microsoft.com') || host.endsWith('teams.live.com')) {
      return 'TEAMS';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * True for a path inside this app (`/groups/1?tab=a`), false for anything that
 * could leave it (`https://…`, protocol-relative `//evil.com`, `javascript:`).
 * Control characters fail too: browsers drop tabs and newlines from a URL, so
 * `/\t/evil.com` would become `//evil.com` if it ever reached `location.href`.
 * Use before navigating to a URL taken from a query param such as `returnUrl`.
 */
export function isInAppPath(value: string | null | undefined): value is string {
  return (
    !!value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

/**
 * Where to go after a guest page (sign in, sign up): the `returnUrl` query
 * param when it is an in-app path, else `fallback` (usually `APP_HOME_URL`).
 */
export function resolveReturnUrl(params: ParamMap, fallback: string): string {
  const returnUrl = params.get('returnUrl');
  return isInAppPath(returnUrl) ? returnUrl : fallback;
}
