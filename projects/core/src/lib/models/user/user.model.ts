import type { UserRole } from './role.enums';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  roles: UserRole[];
  permissions: string[];
  language?: string | null;
  timezone?: string | null;
  countryCode?: string | null;
  city?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: UserRole[];
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  language?: string;
  timezone?: string;
  countryCode?: string | null;
  city?: string | null;
}

/**
 * Richer location data returned by `LocationPicker` when a user
 * selects a place from Nominatim. Only `countryCode` + `city` are
 * persisted on the user account today (see `AccountInfo`); the
 * additional fields (line1, region, postalCode, lat/lng) are kept
 * for the venue module and future address-aware features.
 *
 * Note: there is NO `UserLocation` interface anymore — the historical
 * nested object was flattened into `countryCode` + `city` on `User` /
 * `AccountInfo` in migration 027.
 */
export interface PickedLocation {
  displayName: string;
  line1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface UserSearchParams {
  q: string;
  role?: UserRole;
  excludeConnected?: boolean;
  limit?: number;
}
