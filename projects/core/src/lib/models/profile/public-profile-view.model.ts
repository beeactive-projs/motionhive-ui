/**
 * Viewer mode for the public profile page.
 *
 * - `Guest`  — no authenticated user. Renders the slim public top bar.
 * - `User`   — signed-in non-owner. Renders inside the app sidenav.
 * - `Owner`  — signed-in viewing their own handle. Sidenav + edit affordances.
 *
 * Computed on the inner `PublicProfile` shell, not the page wrapper, so the
 * value travels with the same component regardless of which outer route
 * mounted it.
 */
export const ViewerMode = {
  Guest: 'guest',
  User: 'user',
  Owner: 'owner',
} as const;
export type ViewerMode = typeof ViewerMode[keyof typeof ViewerMode];

/**
 * Actions a guest viewer can attempt that require an account. The shell
 * intercepts these and opens the signup-prompt dialog instead of dispatching
 * the real handler. Copy in the signup-prompt dialog is keyed off this enum.
 */
export const LockedAction = {
  Book: 'book',
  Save: 'save',
  Group: 'group',
  Workout: 'workout',
  Message: 'message',
  Follow: 'follow',
  Train: 'train',
  Photos: 'photos',
} as const;
export type LockedAction = typeof LockedAction[keyof typeof LockedAction];

/**
 * Shared icon set across hero, badges, activity timeline, achievements, goals.
 * Mix of `pi-*` PrimeNG icons and inline SVGs defined alongside the
 * profile sections. Keep this list narrow — new icons get added here so
 * the component templates can validate against the union at compile time.
 */
export type IconName =
  | 'sparkle'
  | 'check'
  | 'star'
  | 'flame'
  | 'shield'
  | 'bolt'
  | 'trophy'
  | 'leaf'
  | 'users'
  | 'target'
  | 'dumbbell'
  | 'lock'
  | 'heart'
  | 'map-pin'
  | 'calendar'
  | 'message-circle'
  | 'play';

/** Tone palette for badges and pulse pills. Maps to honey/navy/teal/green design tokens. */
export type BadgeTone = 'gold' | 'navy' | 'teal' | 'green';
