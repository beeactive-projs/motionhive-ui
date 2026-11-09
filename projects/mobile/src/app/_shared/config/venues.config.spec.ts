/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { MeetingProvider, PickedLocation, Venue, VenueKind } from 'core';

import {
  VENUE_ACTIONS,
  VENUE_ICONS,
  VENUE_KIND_OPTIONS,
  VenueActionIds,
  VenueDraft,
  blankVenueDraft,
  canSaveVenue,
  defaultVenueName,
  meetingLinkInvalid,
  nextVenueName,
  providerFromLink,
  venueCreatePayload,
  venueDraftFrom,
  venueRowLine,
  venueUpdatePayload,
} from './venues.config';

/** The places list and sheet templates, inlined at build time by Vite. */
const templates = import.meta.glob(
  ['../components/venue-list/*.html', '../components/venue-sheet/*.html'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** `location-outline` → `locationOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const registered = new Set(Object.keys(VENUE_ICONS));

/** A key's own text, so a default name is checkable without the language files. */
const say = (key: string) => `«${key}»`;

const cluj: PickedLocation = {
  displayName: 'Strada Memorandumului 28, Cluj-Napoca, Romania',
  line1: 'Strada Memorandumului 28',
  city: 'Cluj-Napoca',
  region: 'Cluj',
  postalCode: '400114',
  countryCode: 'RO',
  country: 'Romania',
  latitude: 46.77,
  longitude: 23.59,
};

function draft(fields: Partial<VenueDraft>): VenueDraft {
  return { ...blankVenueDraft(), ...fields };
}

function venue(fields: Partial<Venue>): Venue {
  return {
    id: 'v-1',
    instructorId: 'i-1',
    kind: VenueKind.GYM,
    isOnline: false,
    name: 'FitZone',
    notes: null,
    line1: null,
    line2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    latitude: null,
    longitude: null,
    meetingUrl: null,
    meetingProvider: null,
    travelRadiusKm: null,
    isActive: true,
    displayOrder: null,
    createdAt: '2026-11-09T00:00:00Z',
    updatedAt: '2026-11-09T00:00:00Z',
    deletedAt: null,
    ...fields,
  } as Venue;
}

describe('VENUE_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere.
  it('registers every icon the list and the sheet name', () => {
    const used = new Set<string>();
    for (const html of Object.values(templates)) {
      // A spinner's `name` is its style, not an icon.
      const withoutSpinners = html.replace(/<ion-spinner[^>]*>/g, '');
      for (const match of withoutSpinners.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) {
        used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });

  it('registers every kind and action glyph', () => {
    const glyphs = [
      ...VENUE_KIND_OPTIONS.map((option) => option.icon),
      ...VENUE_ACTIONS.map((action) => action.icon as string),
    ];
    for (const icon of glyphs) {
      expect(registered, `${icon} is not registered`).toContain(toCamelCase(icon));
    }
  });

  it('offers every kind the API has, once', () => {
    const kinds = VENUE_KIND_OPTIONS.map((option) => option.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect([...kinds].sort()).toEqual(Object.values(VenueKind).sort());
  });
});

describe('VENUE_ACTIONS', () => {
  it('offers Edit details, then Remove as the one red verb', () => {
    expect(VENUE_ACTIONS.map((action) => action.id)).toEqual([
      VenueActionIds.Edit,
      VenueActionIds.Remove,
    ]);
    expect(VENUE_ACTIONS[1]).toMatchObject({ destructive: true, color: 'danger' });
    expect(VENUE_ACTIONS[0].destructive).toBeFalsy();
  });
});

describe('the default name', () => {
  it("is the platform's name online, else Online", () => {
    expect(defaultVenueName(VenueKind.ONLINE, MeetingProvider.ZOOM, say)).toBe('Zoom');
    expect(defaultVenueName(VenueKind.ONLINE, MeetingProvider.GOOGLE_MEET, say)).toBe('Google Meet');
    expect(defaultVenueName(VenueKind.ONLINE, null, say)).toBe('«venues.defaultName.online»');
    expect(defaultVenueName(VenueKind.ONLINE, MeetingProvider.OTHER, say)).toBe(
      '«venues.defaultName.online»',
    );
  });

  it("says At clients' homes for a coach who travels, and nothing for a place with an address", () => {
    expect(defaultVenueName(VenueKind.CLIENT_HOME, null, say)).toBe(
      '«venues.defaultName.clientHome»',
    );
    expect(defaultVenueName(VenueKind.GYM, MeetingProvider.ZOOM, say)).toBe('');
  });

  it('follows the kind while the field is empty or still holds the old default', () => {
    expect(nextVenueName('', '', 'Online')).toBe('Online');
    expect(nextVenueName('Online', 'Online', 'Zoom')).toBe('Zoom');
    expect(nextVenueName(' Zoom ', 'Zoom', '')).toBe('');
  });

  it('never replaces a name the coach typed', () => {
    expect(nextVenueName('My Zoom room', 'Zoom', 'Google Meet')).toBe('My Zoom room');
    expect(nextVenueName('FitZone', '', 'Online')).toBe('FitZone');
  });
});

describe('canSaveVenue', () => {
  it('needs a name', () => {
    expect(canSaveVenue(draft({ kind: VenueKind.ONLINE, name: '  ' }))).toBe(false);
    expect(canSaveVenue(draft({ kind: VenueKind.ONLINE, name: 'Online' }))).toBe(true);
  });

  it('needs a city for a place with an address of its own', () => {
    expect(canSaveVenue(draft({ kind: VenueKind.GYM, name: 'FitZone' }))).toBe(false);
    expect(
      canSaveVenue(draft({ kind: VenueKind.GYM, name: 'FitZone', place: { ...cluj, city: null } })),
    ).toBe(false);
    expect(canSaveVenue(draft({ kind: VenueKind.GYM, name: 'FitZone', place: cluj }))).toBe(true);
  });

  it('takes an online place with no link and no platform', () => {
    expect(canSaveVenue(draft({ kind: VenueKind.ONLINE, name: 'Online' }))).toBe(true);
  });

  it('refuses a link that is not a web link, but only once one is typed', () => {
    const online = draft({ kind: VenueKind.ONLINE, name: 'Zoom' });
    expect(meetingLinkInvalid(online)).toBe(false);
    expect(canSaveVenue({ ...online, meetingUrl: 'javascript:alert(1)' })).toBe(false);
    expect(canSaveVenue({ ...online, meetingUrl: 'zoom.us/j/123' })).toBe(true);
  });

  it("keeps clients' homes to a fair whole distance, and the area optional", () => {
    const home = draft({ kind: VenueKind.CLIENT_HOME, name: "At clients' homes" });
    expect(canSaveVenue(home)).toBe(true);
    expect(canSaveVenue({ ...home, travelRadiusKm: 15 })).toBe(true);
    expect(canSaveVenue({ ...home, travelRadiusKm: 501 })).toBe(false);
    expect(canSaveVenue({ ...home, travelRadiusKm: 2.5 })).toBe(false);
  });
});

describe('providerFromLink', () => {
  it('names the platform a pasted link belongs to', () => {
    expect(providerFromLink('https://us06web.zoom.us/j/123')).toBe(MeetingProvider.ZOOM);
    expect(providerFromLink('meet.google.com/abc-defg-hij')).toBe(MeetingProvider.GOOGLE_MEET);
    expect(providerFromLink('https://example.com/room')).toBeNull();
  });
});

describe('venueCreatePayload', () => {
  it('sends a gym with its address', () => {
    expect(venueCreatePayload(draft({ kind: VenueKind.GYM, name: ' FitZone ', place: cluj }))).toEqual({
      kind: VenueKind.GYM,
      name: 'FitZone',
      line1: 'Strada Memorandumului 28',
      city: 'Cluj-Napoca',
      region: 'Cluj',
      postalCode: '400114',
      countryCode: 'RO',
      latitude: 46.77,
      longitude: 23.59,
    });
  });

  it('sends an online place without a link or platform when it has neither', () => {
    expect(venueCreatePayload(draft({ kind: VenueKind.ONLINE, name: 'Online', place: cluj }))).toEqual({
      kind: VenueKind.ONLINE,
      name: 'Online',
    });
  });

  it('sends the link tidied, with its platform', () => {
    expect(
      venueCreatePayload(
        draft({
          kind: VenueKind.ONLINE,
          name: 'Zoom',
          meetingUrl: ' zoom.us/j/123 ',
          meetingProvider: MeetingProvider.ZOOM,
        }),
      ),
    ).toEqual({
      kind: VenueKind.ONLINE,
      name: 'Zoom',
      meetingUrl: 'https://zoom.us/j/123',
      meetingProvider: MeetingProvider.ZOOM,
    });
  });

  it("sends clients' homes with the area served and the distance, never a street", () => {
    expect(
      venueCreatePayload(
        draft({ kind: VenueKind.CLIENT_HOME, name: "At clients' homes", place: cluj, travelRadiusKm: 15 }),
      ),
    ).toEqual({
      kind: VenueKind.CLIENT_HOME,
      name: "At clients' homes",
      city: 'Cluj-Napoca',
      region: 'Cluj',
      countryCode: 'RO',
      travelRadiusKm: 15,
    });
  });
});

describe('venueUpdatePayload', () => {
  it('clears an emptied link and an untapped platform with null', () => {
    expect(venueUpdatePayload(draft({ kind: VenueKind.ONLINE, name: 'Online' }))).toEqual({
      kind: VenueKind.ONLINE,
      name: 'Online',
      meetingUrl: null,
      meetingProvider: null,
    });
  });

  it('empties the address parts a new pick lacks, so the old street does not stay', () => {
    const payload = venueUpdatePayload(
      draft({ kind: VenueKind.PARK, name: 'Central Park', place: { ...cluj, line1: null, postalCode: null } }),
    );
    expect(payload.line1).toBe('');
    expect(payload.postalCode).toBe('');
    expect(payload.city).toBe('Cluj-Napoca');
  });

  it("takes the area off clients' homes when it was removed", () => {
    expect(venueUpdatePayload(draft({ kind: VenueKind.CLIENT_HOME, name: 'Home visits' }))).toEqual({
      kind: VenueKind.CLIENT_HOME,
      name: 'Home visits',
      city: '',
      region: '',
      countryCode: '',
    });
  });
});

describe('venueDraftFrom', () => {
  it('fills the sheet from a saved place, so saving it unchanged sends the same', () => {
    const saved = venue({
      kind: VenueKind.GYM,
      name: 'FitZone',
      line1: 'Strada Memorandumului 28',
      city: 'Cluj-Napoca',
      region: 'Cluj',
      postalCode: '400114',
      countryCode: 'RO',
      latitude: 46.77,
      longitude: 23.59,
    });
    const filled = venueDraftFrom(saved);
    expect(filled.place?.displayName).toBe('Strada Memorandumului 28, Cluj-Napoca');
    expect(venueUpdatePayload(filled)).toMatchObject({
      line1: 'Strada Memorandumului 28',
      city: 'Cluj-Napoca',
      postalCode: '400114',
    });
  });

  it('leaves an online place without an address and keeps its link', () => {
    const filled = venueDraftFrom(
      venue({
        kind: VenueKind.ONLINE,
        isOnline: true,
        name: 'Zoom',
        meetingUrl: 'https://zoom.us/j/1',
        meetingProvider: MeetingProvider.ZOOM,
      }),
    );
    expect(filled.place).toBeNull();
    expect(filled.meetingUrl).toBe('https://zoom.us/j/1');
    expect(filled.meetingProvider).toBe(MeetingProvider.ZOOM);
  });
});

describe('venueRowLine', () => {
  it('says the platform for an online place, or just Online', () => {
    expect(
      venueRowLine(venue({ kind: VenueKind.ONLINE, isOnline: true, meetingProvider: MeetingProvider.TEAMS })),
    ).toEqual({
      icon: 'videocam-outline',
      kindLabel: 'venues.kind.ONLINE',
      detail: 'Microsoft Teams',
      detailIsKey: false,
    });
    expect(
      venueRowLine(venue({ kind: VenueKind.ONLINE, isOnline: true, meetingProvider: MeetingProvider.OTHER })),
    ).toMatchObject({ detail: 'venues.provider.OTHER', detailIsKey: true });
    expect(venueRowLine(venue({ kind: VenueKind.ONLINE, isOnline: true })).detail).toBeNull();
  });

  it('reads an online flag on another kind as online', () => {
    expect(venueRowLine(venue({ kind: VenueKind.OTHER, isOnline: true, city: 'Cluj' })).kindLabel).toBe(
      'venues.kind.ONLINE',
    );
  });

  it('gives a place its kind and city, and only the kind without one', () => {
    expect(venueRowLine(venue({ kind: VenueKind.GYM, city: ' Bucharest ' }))).toEqual({
      icon: 'barbell-outline',
      kindLabel: 'venues.kind.GYM',
      detail: 'Bucharest',
      detailIsKey: false,
    });
    expect(venueRowLine(venue({ kind: VenueKind.CLIENT_HOME })).detail).toBeNull();
  });
});
