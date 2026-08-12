/**
 * Handle rules — the vanity slug behind `/@someone`.
 *
 * These mirror the server's validation. They live here rather than in a dialog
 * because both the web edit-handle dialog and the mobile handle sheet need the
 * same answer, and a drift between them shows up as a save that the API rejects
 * with no client-side warning.
 */

/** Lowercase alphanumerics, with `-`/`_` allowed anywhere but the ends. */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 40;

/** What the user typed, as it would be stored. Always compare normalized forms. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The reason `raw` is not a usable handle, or `null` when it is. Uniqueness is
 * the server's call — this only covers shape.
 */
export function handleValidationError(raw: string): string | null {
  const handle = normalizeHandle(raw);
  if (!handle) return 'Pick a handle.';
  if (handle.length < HANDLE_MIN_LENGTH) {
    return `Use at least ${HANDLE_MIN_LENGTH} characters.`;
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return `Use at most ${HANDLE_MAX_LENGTH} characters.`;
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return 'Use lowercase letters, numbers, hyphens and underscores. Start and end with a letter or number.';
  }
  return null;
}
