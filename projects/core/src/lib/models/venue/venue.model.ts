import type { MeetingProvider, VenueKind } from './venue.enums';

/**
 * A place where an instructor delivers their service. Owned by one
 * instructor, referenced by sessions.
 */
export interface Venue {
  id: string;
  instructorId: string;
  kind: VenueKind;
  isOnline: boolean;
  name: string;
  notes: string | null;

  // Physical address (null for ONLINE / CLIENT_HOME)
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  /** ISO 3166-1 alpha-2 */
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;

  // Online-only
  meetingUrl: string | null;
  meetingProvider: MeetingProvider | null;

  // Mobile trainer (CLIENT_HOME)
  travelRadiusKm: number | null;

  isActive: boolean;
  displayOrder: number | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateVenuePayload {
  kind: VenueKind;
  isOnline?: boolean;
  name: string;
  notes?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  meetingUrl?: string;
  meetingProvider?: MeetingProvider;
  travelRadiusKm?: number;
  isActive?: boolean;
  displayOrder?: number;
}

export type UpdateVenuePayload = Partial<CreateVenuePayload>;
