import {
  PublicSessionInstance,
  SESSION_LOCATION_KINDS,
  SessionLocationKind,
  WEB_APP_URL,
} from 'core';

/** What the phone's "new event" screen is filled in with. */
export interface SessionCalendarEvent {
  title: string;
  /** Epoch milliseconds, as the calendar plugin takes them. */
  startDate: number;
  endDate: number;
  location: string | null;
  /** The session's link: opens it in the app where installed, else the web. */
  url: string;
}

/**
 * A session as a calendar event. The place is the date's own venue, else
 * the series' usual one, as name and city (never the street, which is the
 * booking's to show); an online session says Online and never carries the
 * meeting link, which the session page gives at the right time.
 */
export function sessionCalendarEvent(
  instance: PublicSessionInstance,
  fallbackTitle: string,
): SessionCalendarEvent {
  let title = fallbackTitle;
  if (instance.titleOverride) {
    title = instance.titleOverride;
  } else if (instance.template?.title) {
    title = instance.template.title;
  }

  let location: string | null = null;
  if (instance.template?.locationKind === SessionLocationKind.Online) {
    location = SESSION_LOCATION_KINDS[SessionLocationKind.Online].label;
  } else {
    let venue = instance.venueOverride ?? null;
    if (!venue) {
      venue = instance.template?.venue ?? null;
    }
    if (venue) {
      const parts = [venue.name, venue.city].filter((part): part is string => !!part);
      if (parts.length > 0) {
        location = parts.join(', ');
      }
    }
  }

  return {
    title,
    startDate: new Date(instance.startAt).getTime(),
    endDate: new Date(instance.endAt).getTime(),
    location,
    url: `${WEB_APP_URL}/sessions/${instance.id}`,
  };
}
