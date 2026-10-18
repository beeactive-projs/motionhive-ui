/** A leading hex tile: an ionicons name and the Ionic palette colour it sits on. */
export interface DetailTile {
  readonly icon: string;
  readonly color: string;
}

/**
 * One tile per personal detail, wherever a list shows it: the privacy screen,
 * the account preferences, a public profile, a person's page. A detail keeps
 * its colour from screen to screen, so the eye learns it once.
 *
 * Six distinct hues, because a full profile lists all six in one card. None
 * of them is honey or red: honey is the appearance row's beside language and
 * timezone on the account screen, and red is the notifications row's.
 */
export const DETAIL_TILES = {
  email: { icon: 'mail-outline', color: 'info' },
  phone: { icon: 'call-outline', color: 'success' },
  location: { icon: 'location-outline', color: 'teal' },
  language: { icon: 'language-outline', color: 'violet' },
  timezone: { icon: 'time-outline', color: 'coral' },
  memberSince: { icon: 'calendar-outline', color: 'secondary' },
} as const satisfies Record<string, DetailTile>;
