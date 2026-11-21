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
 * Six distinct hues for the first six, because a full profile lists them in
 * one card. None of them is honey or red: honey is the appearance row's
 * beside language and timezone on the account screen, and red is the
 * notifications row's. Birthday and gender come after them (the privacy
 * card): the birthday takes the navy of the other date, member since, which
 * that card never shows, and the gender the violet of people and profiles,
 * three rows from language, so neighbours still differ.
 */
export const DETAIL_TILES = {
  email: { icon: 'mail-outline', color: 'info' },
  phone: { icon: 'call-outline', color: 'success' },
  location: { icon: 'location-outline', color: 'teal' },
  language: { icon: 'language-outline', color: 'violet' },
  timezone: { icon: 'time-outline', color: 'coral' },
  memberSince: { icon: 'calendar-outline', color: 'secondary' },
  birthday: { icon: 'gift-outline', color: 'secondary' },
  gender: { icon: 'person-outline', color: 'violet' },
} as const satisfies Record<string, DetailTile>;
