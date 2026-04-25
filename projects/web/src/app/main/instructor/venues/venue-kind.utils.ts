import { MeetingProvider, VenueKind } from 'core';

/**
 * Display metadata for each venue kind. Keep the labels short — they
 * render in chips and list rows. The icon is a PrimeIcons class.
 */
export const VENUE_KIND_META: Record<
  VenueKind,
  { label: string; icon: string; description: string }
> = {
  [VenueKind.GYM]: {
    label: 'Gym',
    icon: 'pi pi-building',
    description: 'A gym or fitness club you work out of.',
  },
  [VenueKind.STUDIO]: {
    label: 'Studio',
    icon: 'pi pi-objects-column',
    description: 'A private studio space.',
  },
  [VenueKind.PARK]: {
    label: 'Park',
    icon: 'pi pi-sun',
    description: 'An outdoor park location.',
  },
  [VenueKind.OUTDOOR]: {
    label: 'Outdoor',
    icon: 'pi pi-compass',
    description: 'Other outdoor location (beach, trail, etc).',
  },
  [VenueKind.CLIENT_HOME]: {
    label: "Client's place",
    icon: 'pi pi-home',
    description: "You travel to the client's location.",
  },
  [VenueKind.ONLINE]: {
    label: 'Online',
    icon: 'pi pi-video',
    description: 'Video call via Zoom, Meet, etc.',
  },
  [VenueKind.OTHER]: {
    label: 'Other',
    icon: 'pi pi-map-marker',
    description: 'Something else.',
  },
};

export const MEETING_PROVIDER_META: Record<
  MeetingProvider,
  { label: string }
> = {
  [MeetingProvider.ZOOM]: { label: 'Zoom' },
  [MeetingProvider.GOOGLE_MEET]: { label: 'Google Meet' },
  [MeetingProvider.TEAMS]: { label: 'Microsoft Teams' },
  [MeetingProvider.OTHER]: { label: 'Other' },
};

export const VENUE_KINDS_ORDERED: VenueKind[] = [
  VenueKind.GYM,
  VenueKind.STUDIO,
  VenueKind.PARK,
  VenueKind.OUTDOOR,
  VenueKind.CLIENT_HOME,
  VenueKind.ONLINE,
  VenueKind.OTHER,
];

export function isPhysicalKind(kind: VenueKind): boolean {
  return (
    kind !== VenueKind.ONLINE && kind !== VenueKind.CLIENT_HOME
  );
}
