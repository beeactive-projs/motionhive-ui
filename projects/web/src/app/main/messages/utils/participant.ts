/**
 * Loose shape: anything with first/last name strings (or null). Both
 * `ParticipantSnapshot` (DM other-user) and `UserSearchResult`
 * (new-message picker rows) satisfy this — we don't import either
 * type so this util stays decoupled from the BE contracts.
 */
interface NamedLike {
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Display name for a named entity. Joins `firstName + ' ' + lastName`,
 * dropping empty/null parts. Falls back to the supplied default when
 * the snapshot is null or has no usable fields (e.g. soft-deleted user).
 */
export function displayName(
  snapshot: NamedLike | null | undefined,
  fallback = 'Unknown',
): string {
  if (!snapshot) return fallback;
  const full = [snapshot.firstName, snapshot.lastName]
    .filter((s): s is string => !!s)
    .join(' ')
    .trim();
  return full || fallback;
}

/**
 * Initials for the hex-avatar fallback (e.g. "AB" for "Ana Bell").
 * Returns "?" when no initial can be derived.
 */
export function initialsOf(
  snapshot: NamedLike | null | undefined,
): string {
  if (!snapshot) return '?';
  const f = (snapshot.firstName ?? '').charAt(0);
  const l = (snapshot.lastName ?? '').charAt(0);
  return (f + l).toUpperCase() || '?';
}
