/**
 * Hex-avatar tone palette + deterministic picker.
 *
 * Per the messaging design (see CODING_AGENT_PROMPT.md §3): "Assign tone
 * deterministically from a hash of the user id so the same person is
 * always the same color."
 *
 * The palette matches the design tokens (honey / coral / teal / navy)
 * in their `*-soft` variants. The strong tones (`honey`, `coral`, etc.)
 * are kept available for system or admin avatars where we want extra
 * emphasis.
 */
export type HexAvatarTone =
  | 'honey'
  | 'honey-soft'
  | 'coral'
  | 'coral-soft'
  | 'teal'
  | 'teal-soft'
  | 'navy'
  | 'navy-soft'
  | 'cream';

/**
 * Tones the deterministic picker rotates through. Strong tones are
 * excluded so two random users never collide on a high-contrast color
 * (those are reserved for explicit role-based assignment).
 */
const ROTATING_TONES: ReadonlyArray<HexAvatarTone> = [
  'honey-soft',
  'coral-soft',
  'teal-soft',
  'navy-soft',
];

/**
 * Deterministic per-user tone. Same id → same tone, every time, in
 * every component, across reloads. Uses a small djb2-style hash so we
 * avoid pulling in a crypto dependency for what's purely a UI signal.
 */
export function toneForUserId(userId: string | null | undefined): HexAvatarTone {
  if (!userId) return 'navy-soft';
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ROTATING_TONES.length;
  return ROTATING_TONES[idx];
}

/**
 * Resolve a tone to its (bg, fg) hex pair. Kept inside this file so the
 * palette is single-source-of-truth and components never inline colors.
 */
export const HEX_AVATAR_PALETTE: Record<HexAvatarTone, { bg: string; fg: string }> = {
  honey:        { bg: '#f59e0b', fg: '#0f172a' },
  'honey-soft': { bg: '#fef3c7', fg: '#92400e' },
  coral:        { bg: '#f97066', fg: '#ffffff' },
  'coral-soft': { bg: '#ffe4dc', fg: '#c4392f' },
  teal:         { bg: '#14b8a6', fg: '#ffffff' },
  'teal-soft':  { bg: '#ccfbf1', fg: '#0f766e' },
  navy:         { bg: '#1e293b', fg: '#ffffff' },
  'navy-soft':  { bg: '#e2e8f0', fg: '#1e293b' },
  cream:        { bg: '#f7f1e6', fg: '#475569' },
};

/** Hexagon clip-path used by every hex avatar in the app. */
export const HEX_CLIP_PATH =
  'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)';
