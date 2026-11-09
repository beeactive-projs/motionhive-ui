import {
  CreateVenuePayload,
  MeetingProvider,
  PickedLocation,
  UpdateVenuePayload,
  Venue,
  VenueKind,
  detectMeetingProvider,
  normalizeUrl,
} from 'core';
import {
  addOutline,
  barbellOutline,
  businessOutline,
  ellipsisHorizontalOutline,
  homeOutline,
  leafOutline,
  locationOutline,
  trailSignOutline,
  trashOutline,
  createOutline,
  videocamOutline,
} from 'ionicons/icons';

import type { SheetAction } from '../components/action-sheet/action-sheet.model';

/** The API's limits on a place (CreateVenueDto). */
export const VENUE_NAME_MAX_LENGTH = 160;
export const VENUE_TRAVEL_MAX_KM = 500;
export const VENUE_MEETING_URL_MAX_LENGTH = 500;

/**
 * Every icon the places list, its sheet and its actions draw, for
 * `addIcons()`. `venues.config.spec.ts` checks the templates against it.
 */
export const VENUE_ICONS = {
  addOutline,
  barbellOutline,
  businessOutline,
  createOutline,
  ellipsisHorizontalOutline,
  homeOutline,
  leafOutline,
  locationOutline,
  trailSignOutline,
  trashOutline,
  videocamOutline,
};

/** One kind of place: its chip and tile glyph, and its label key (`venues.kind.<KIND>`). */
export interface VenueKindOption {
  kind: VenueKind;
  icon: string;
  label: string;
}

/** The kinds in the order the sheet offers them: the usual ones first, Other last. */
export const VENUE_KIND_OPTIONS: readonly VenueKindOption[] = [
  { kind: VenueKind.GYM, icon: 'barbell-outline', label: 'venues.kind.GYM' },
  { kind: VenueKind.STUDIO, icon: 'business-outline', label: 'venues.kind.STUDIO' },
  { kind: VenueKind.PARK, icon: 'leaf-outline', label: 'venues.kind.PARK' },
  { kind: VenueKind.OUTDOOR, icon: 'trail-sign-outline', label: 'venues.kind.OUTDOOR' },
  { kind: VenueKind.CLIENT_HOME, icon: 'home-outline', label: 'venues.kind.CLIENT_HOME' },
  { kind: VenueKind.ONLINE, icon: 'videocam-outline', label: 'venues.kind.ONLINE' },
  { kind: VenueKind.OTHER, icon: 'location-outline', label: 'venues.kind.OTHER' },
];

/** One platform an online place runs on. Brand names stay as they are; Other is translated. */
export interface MeetingProviderOption {
  provider: MeetingProvider;
  /** The brand's name, or null when the label is a translation key. */
  brand: string | null;
  label: string;
}

export const MEETING_PROVIDER_OPTIONS: readonly MeetingProviderOption[] = [
  { provider: MeetingProvider.ZOOM, brand: 'Zoom', label: 'Zoom' },
  { provider: MeetingProvider.GOOGLE_MEET, brand: 'Google Meet', label: 'Google Meet' },
  { provider: MeetingProvider.TEAMS, brand: 'Microsoft Teams', label: 'Microsoft Teams' },
  { provider: MeetingProvider.OTHER, brand: null, label: 'venues.provider.OTHER' },
];

/** The ⋯ on a place: change it, or take it off the profile. */
export const VenueActionIds = { Edit: 'edit', Remove: 'remove' } as const;
export type VenueActionId = (typeof VenueActionIds)[keyof typeof VenueActionIds];

export const VENUE_ACTIONS: readonly SheetAction<VenueActionId>[] = [
  { id: VenueActionIds.Edit, label: 'venues.actions.edit', icon: 'create-outline', color: 'primary' },
  {
    id: VenueActionIds.Remove,
    label: 'venues.actions.remove',
    icon: 'trash-outline',
    color: 'danger',
    destructive: true,
  },
];

/** What the sheet holds while a place is added or changed. */
export interface VenueDraft {
  kind: VenueKind;
  name: string;
  /** The picked address (a place), or the area served (clients' homes). */
  place: PickedLocation | null;
  meetingProvider: MeetingProvider | null;
  /** As typed: checked and tidied on save. */
  meetingUrl: string;
  travelRadiusKm: number | null;
}

/** A place with an address of its own, which the API wants a city for. */
export function needsAddress(kind: VenueKind): boolean {
  return kind !== VenueKind.ONLINE && kind !== VenueKind.CLIENT_HOME;
}

/** Clients' homes: no street, but the area served may be named. */
export function takesArea(kind: VenueKind): boolean {
  return kind === VenueKind.CLIENT_HOME;
}

export function kindOption(kind: VenueKind): VenueKindOption {
  const found = VENUE_KIND_OPTIONS.find((option) => option.kind === kind);
  if (found) {
    return found;
  }
  return VENUE_KIND_OPTIONS[VENUE_KIND_OPTIONS.length - 1];
}

export function providerOption(provider: MeetingProvider | null): MeetingProviderOption | null {
  if (!provider) {
    return null;
  }
  const found = MEETING_PROVIDER_OPTIONS.find((option) => option.provider === provider);
  if (found) {
    return found;
  }
  return null;
}

/** An empty sheet: a gym, the most common place, with nothing filled in. */
export function blankVenueDraft(): VenueDraft {
  return {
    kind: VenueKind.GYM,
    name: '',
    place: null,
    meetingProvider: null,
    meetingUrl: '',
    travelRadiusKm: null,
  };
}

/** The sheet filled from a saved place. */
export function venueDraftFrom(venue: Venue): VenueDraft {
  let place: PickedLocation | null = null;
  if (venue.city || venue.line1) {
    place = {
      displayName: addressText(venue.line1, venue.city),
      line1: venue.line1,
      city: venue.city,
      region: venue.region,
      postalCode: venue.postalCode,
      countryCode: venue.countryCode,
      country: null,
      latitude: venue.latitude,
      longitude: venue.longitude,
    };
  }
  return {
    kind: venue.kind,
    name: venue.name,
    place,
    meetingProvider: venue.meetingProvider,
    meetingUrl: venue.meetingUrl ?? '',
    travelRadiusKm: venue.travelRadiusKm,
  };
}

/** "Str. Memorandumului 28, Cluj-Napoca": the street and the city that are there. */
export function addressText(line1: string | null, city: string | null): string {
  const parts: string[] = [];
  for (const part of [line1, city]) {
    if (part && part.trim()) {
      parts.push(part.trim());
    }
  }
  return parts.join(', ');
}

/** How a picked address reads on its row: the street and city, or what the search called it. */
export function placeText(place: PickedLocation): string {
  const text = addressText(place.line1, place.city);
  if (text) {
    return text;
  }
  return place.displayName;
}

/**
 * The name a kind (and, online, its platform) offers before anything is
 * typed: the platform's own name, "Online", "At clients' homes". A place
 * with an address of its own gets none: only its name says which gym.
 * `translate` turns a key into the reader's words.
 */
export function defaultVenueName(
  kind: VenueKind,
  provider: MeetingProvider | null,
  translate: (key: string) => string,
): string {
  if (kind === VenueKind.ONLINE) {
    const option = providerOption(provider);
    if (option && option.brand) {
      return option.brand;
    }
    return translate('venues.defaultName.online');
  }
  if (kind === VenueKind.CLIENT_HOME) {
    return translate('venues.defaultName.clientHome');
  }
  return '';
}

/**
 * The name after the kind or platform changed: the new default while the
 * field is empty or still holds the old default, else what was typed.
 */
export function nextVenueName(current: string, previousDefault: string, nextDefault: string): string {
  const typed = current.trim();
  if (typed === '' || typed === previousDefault.trim()) {
    return nextDefault;
  }
  return current;
}

/** The link as it will be saved, or null when there is none or it is not a web link. */
export function meetingLinkOf(draft: Pick<VenueDraft, 'meetingUrl'>): string | null {
  return normalizeUrl(draft.meetingUrl);
}

/** A link is typed and is not one: the field says so and Save waits. */
export function meetingLinkInvalid(draft: Pick<VenueDraft, 'meetingUrl'>): boolean {
  const typed = draft.meetingUrl.trim();
  if (typed === '') {
    return false;
  }
  const link = meetingLinkOf(draft);
  return link === null || link.length > VENUE_MEETING_URL_MAX_LENGTH;
}

/** The platform a pasted link names, when none is picked yet. */
export function providerFromLink(url: string): MeetingProvider | null {
  const detected = detectMeetingProvider(url);
  if (!detected) {
    return null;
  }
  return detected as MeetingProvider;
}

function travelValid(km: number | null): boolean {
  if (km === null) {
    return true;
  }
  return Number.isInteger(km) && km >= 0 && km <= VENUE_TRAVEL_MAX_KM;
}

/** Whether the API will take the sheet as it is: a name, a city where one is needed, a real link, a fair distance. */
export function canSaveVenue(draft: VenueDraft): boolean {
  const name = draft.name.trim();
  if (name === '' || name.length > VENUE_NAME_MAX_LENGTH) {
    return false;
  }
  if (needsAddress(draft.kind)) {
    if (!draft.place || !draft.place.city) {
      return false;
    }
  }
  if (draft.kind === VenueKind.ONLINE && meetingLinkInvalid(draft)) {
    return false;
  }
  if (draft.kind === VenueKind.CLIENT_HOME && !travelValid(draft.travelRadiusKm)) {
    return false;
  }
  return true;
}

/** A value for the payload: the trimmed text, or nothing. */
function textOrUndefined(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

/** What a new place sends (`POST /venues`). Only the fields its kind keeps. */
export function venueCreatePayload(draft: VenueDraft): CreateVenuePayload {
  const payload: CreateVenuePayload = { kind: draft.kind, name: draft.name.trim() };
  const place = draft.place;

  if (needsAddress(draft.kind) && place) {
    payload.line1 = textOrUndefined(place.line1);
    payload.city = textOrUndefined(place.city);
    payload.region = textOrUndefined(place.region);
    payload.postalCode = textOrUndefined(place.postalCode);
    payload.countryCode = textOrUndefined(place.countryCode);
    if (place.latitude !== null) {
      payload.latitude = place.latitude;
    }
    if (place.longitude !== null) {
      payload.longitude = place.longitude;
    }
  }

  if (takesArea(draft.kind) && place) {
    payload.city = textOrUndefined(place.city);
    payload.region = textOrUndefined(place.region);
    payload.countryCode = textOrUndefined(place.countryCode);
  }

  if (draft.kind === VenueKind.ONLINE) {
    const link = meetingLinkOf(draft);
    if (link) {
      payload.meetingUrl = link;
    }
    if (draft.meetingProvider) {
      payload.meetingProvider = draft.meetingProvider;
    }
  }

  if (takesArea(draft.kind) && draft.travelRadiusKm !== null) {
    payload.travelRadiusKm = draft.travelRadiusKm;
  }

  return payload;
}

/**
 * What a change sends (`PATCH /venues/:id`). The API keeps a field the
 * payload leaves out, so an address part the new pick lacks goes as `''`
 * (the API clears it: postcode and country included), and an emptied link
 * or untapped platform goes as `null` (cleared). Fields another kind keeps
 * are dropped by the API itself.
 */
export function venueUpdatePayload(draft: VenueDraft): UpdateVenuePayload {
  const payload: UpdateVenuePayload = { kind: draft.kind, name: draft.name.trim() };
  const place = draft.place;

  if (needsAddress(draft.kind) && place) {
    payload.line1 = textOrEmpty(place.line1);
    payload.city = textOrEmpty(place.city);
    payload.region = textOrEmpty(place.region);
    payload.postalCode = textOrEmpty(place.postalCode);
    payload.countryCode = textOrUndefined(place.countryCode);
    if (place.latitude !== null) {
      payload.latitude = place.latitude;
    }
    if (place.longitude !== null) {
      payload.longitude = place.longitude;
    }
  }

  if (takesArea(draft.kind)) {
    if (place) {
      payload.city = textOrEmpty(place.city);
      payload.region = textOrEmpty(place.region);
      payload.countryCode = textOrUndefined(place.countryCode);
    } else {
      payload.city = '';
      payload.region = '';
      payload.countryCode = '';
    }
    if (draft.travelRadiusKm !== null) {
      payload.travelRadiusKm = draft.travelRadiusKm;
    }
  }

  if (draft.kind === VenueKind.ONLINE) {
    payload.meetingUrl = meetingLinkOf(draft);
    payload.meetingProvider = draft.meetingProvider;
  }

  return payload;
}

function textOrEmpty(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.trim();
}

/** How a place reads in a list: its tile glyph, and the parts of the line under its name. */
export interface VenueRowLine {
  icon: string;
  /** The kind, as a translation key. */
  kindLabel: string;
  /** Said after the kind: the platform for an online place, else the city. Null when there is none. */
  detail: string | null;
  /** The detail is a translation key (the platform Other), not text. */
  detailIsKey: boolean;
}

/**
 * Online places say what they run on (or just Online); clients' homes and
 * places say their city when they have one. An online flag on another kind
 * (older rows) reads as online too.
 */
export function venueRowLine(
  venue: Pick<Venue, 'kind' | 'isOnline' | 'city' | 'meetingProvider'>,
): VenueRowLine {
  if (venue.isOnline || venue.kind === VenueKind.ONLINE) {
    const online = kindOption(VenueKind.ONLINE);
    const option = providerOption(venue.meetingProvider);
    if (option) {
      return {
        icon: online.icon,
        kindLabel: online.label,
        detail: option.label,
        detailIsKey: option.brand === null,
      };
    }
    return { icon: online.icon, kindLabel: online.label, detail: null, detailIsKey: false };
  }
  const option = kindOption(venue.kind);
  let city: string | null = null;
  if (venue.city && venue.city.trim()) {
    city = venue.city.trim();
  }
  return { icon: option.icon, kindLabel: option.label, detail: city, detailIsKey: false };
}
