/** Avatar fills. Each has an `--ion-color-*` + `.ion-color-*` pair in `theme/variables.css`. */
const AVATAR_TONES = ['primary', 'teal', 'secondary', 'coral'] as const;

export type AvatarTone = (typeof AVATAR_TONES)[number];

/**
 * Hexagon fill for a person, keyed on their id rather than their position in a
 * list — an inbox reorders on every incoming message, and an index-based tone
 * would repaint half the avatars each time one arrives.
 *
 * djb2 plus an avalanche step. The mixing is not decoration: `% 4` reads only
 * the bottom two bits, and djb2 barely moves those between similar strings, so
 * the raw hash lands ids that share a prefix on the same two tones. UUIDs share
 * a lot of shape.
 */
export function avatarToneFor(id: string | null | undefined): AvatarTone {
  if (!id) return AVATAR_TONES[0];

  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(hash, 33) + id.charCodeAt(i)) | 0;
  }

  // Pull the high bits down so the modulo sees mixed ones.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;

  return AVATAR_TONES[(hash >>> 0) % AVATAR_TONES.length];
}
