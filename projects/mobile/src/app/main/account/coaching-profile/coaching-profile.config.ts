import { Venue, VenueKind } from 'core';
import { homeOutline, videocamOutline } from 'ionicons/icons';

import { ACCOUNT_ICONS } from '../account.config';

/**
 * Every icon the coaching profile renders: the account set, plus the venue
 * tiles only this screen draws. `coaching-profile.config.spec.ts` checks the
 * screen's templates and `venueLine` against it.
 */
export const COACHING_PROFILE_ICONS = {
  ...ACCOUNT_ICONS,
  homeOutline,
  videocamOutline,
};

/** How a venue row reads: its tile glyph and the line under the name. */
export interface VenueLine {
  icon: string;
  /** A translation key, for a venue with no address of its own. */
  key: string | null;
  /** The city, for a place that has one. */
  city: string | null;
}

/**
 * Online venues and a coach who travels to the client have no address, so
 * they say what they are instead of a city; a place says its city. A missing
 * city used to read "Online", which was wrong for a coach who comes to you.
 */
export function venueLine(venue: Pick<Venue, 'kind' | 'isOnline' | 'city'>): VenueLine {
  if (venue.isOnline || venue.kind === VenueKind.ONLINE) {
    return { icon: 'videocam-outline', key: 'account.coachingProfile.venues.online', city: null };
  }
  if (venue.kind === VenueKind.CLIENT_HOME) {
    return { icon: 'home-outline', key: 'account.coachingProfile.venues.clientHome', city: null };
  }
  return { icon: 'location-outline', key: null, city: venue.city?.trim() || null };
}

/**
 * A price and how it is billed on one line: "RON 75.00 · One-off", but
 * "RON 200.00 / month", since a per-interval label brings its own slash and
 * a dot before it read "RON 200.00 · / month".
 */
export function priceLine(price: string, billing: string): string {
  const label = billing.trim();
  if (!label) return price;
  return label.startsWith('/') ? `${price} ${label}` : `${price} · ${label}`;
}
