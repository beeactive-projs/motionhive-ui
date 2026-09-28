import { MeetingProvider, VenueKind, translate } from 'core';

interface VenueKindMeta {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

/**
 * Label + description translate on read (`venues.kind.<KIND>` /
 * `venues.kindHint.<KIND>`): this is a module constant, evaluated before
 * the language file loads.
 */
function kindMeta(kind: VenueKind, icon: string): VenueKindMeta {
  return {
    icon,
    get label() {
      return translate(`venues.kind.${kind}`);
    },
    get description() {
      return translate(`venues.kindHint.${kind}`);
    },
  };
}

/**
 * Display metadata for each venue kind. Keep the labels short — they
 * render in chips and list rows. The icon is a PrimeIcons class.
 */
export const VENUE_KIND_META: Record<VenueKind, VenueKindMeta> = {
  [VenueKind.GYM]: kindMeta(VenueKind.GYM, 'pi pi-building'),
  [VenueKind.STUDIO]: kindMeta(VenueKind.STUDIO, 'pi pi-objects-column'),
  [VenueKind.PARK]: kindMeta(VenueKind.PARK, 'pi pi-sun'),
  [VenueKind.OUTDOOR]: kindMeta(VenueKind.OUTDOOR, 'pi pi-compass'),
  [VenueKind.CLIENT_HOME]: kindMeta(VenueKind.CLIENT_HOME, 'pi pi-home'),
  [VenueKind.ONLINE]: kindMeta(VenueKind.ONLINE, 'pi pi-video'),
  [VenueKind.OTHER]: kindMeta(VenueKind.OTHER, 'pi pi-map-marker'),
};

/** Brand names stay untranslated; only "Other" goes through a key. */
export const MEETING_PROVIDER_META: Record<
  MeetingProvider,
  { readonly label: string }
> = {
  [MeetingProvider.ZOOM]: { label: 'Zoom' },
  [MeetingProvider.GOOGLE_MEET]: { label: 'Google Meet' },
  [MeetingProvider.TEAMS]: { label: 'Microsoft Teams' },
  [MeetingProvider.OTHER]: {
    get label() {
      return translate('venues.form.providerOther');
    },
  },
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
