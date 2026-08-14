/**
 * Client-side guards for the profile picture upload (`POST /users/me/avatar`).
 *
 * Web enforces these inline in the profile hero card and silently drops a file
 * that fails; keeping the limits here lets mobile apply the same rule and, more
 * usefully, tell the user which one they hit.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Value for a file input's `accept`. */
export const AVATAR_ACCEPT = 'image/*';

/** Why `file` cannot be used as an avatar, or `null` when it can. */
export function avatarRejectionReason(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Pick an image file.';
  if (file.size > AVATAR_MAX_BYTES) {
    return `Images must be under ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}
