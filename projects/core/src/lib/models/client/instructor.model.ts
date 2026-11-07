import { User } from '../user/user.model';
import { InstructorCertification } from '../profile/instructor-profile.model';
import { CoachDirectorySort, CoachSuggestionReason } from './client.enums';

/**
 * A coach from `GET /profile/instructors/suggested`, picked for the reader:
 * never themselves, a coach they already have, or someone either side blocked.
 */
export interface SuggestedCoach {
  /** Instructor profile id. */
  id: string;
  /** User id: what a draft message or a profile is addressed by. */
  userId: string;
  handle: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  displayName: string | null;
  specializations: string[] | null;
  /** What they coach, ids from `GET /categories` (`CategoryStore`). Older APIs omit it. */
  categoryIds?: string[];
  yearsOfExperience: number | null;
  city: string | null;
  countryCode: string | null;
  /** `string` too: a newer API may send a reason this build does not know. */
  reason: CoachSuggestionReason | (string & {});
}

export interface MyInstructorProfile {
  userId: string;
  displayName: string | null;
  specializations: string[];
  bio: string | null;
}

export interface MyInstructor {
  id: string;
  instructorId: string;
  clientId: string;
  status: string;
  startedAt: string;
  instructor: User;
  instructorProfile: MyInstructorProfile | null;
}

/**
 * Backend returns a plain array of active instructor relationships.
 */
export type InstructorListResponse = MyInstructor[];

export interface InstructorSearchResult {
  id: string;
  userId: string;
  handle: string | null;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  bio: string | null;
  specializations: string[] | null;
  /** What they coach, ids from `GET /categories` (`CategoryStore`). Older APIs omit it. */
  categoryIds?: string[];
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  /** Has an active online venue (a meeting link): what "Online" means everywhere. */
  isOnline: boolean;
  city: string | null;
  countryCode: string | null;
  socialLinks: Record<string, string> | null;
  /**
   * The reader asked this coach and is still waiting on an answer. Only the
   * directory (`GET /profile/instructors/directory`) sends it; Discover's
   * list does not know who is reading.
   */
  requestSent?: boolean;
}

/**
 * `GET /profile/instructors/directory` query. Filters combine with AND; a
 * signed-in reader is never in the list, so a page is never short.
 */
export interface CoachDirectoryParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Contains, blind to accents and case. */
  city?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  accepting?: boolean;
  online?: boolean;
  /** Only coaches the reader asked and is still waiting on (`requestSent`). */
  requested?: boolean;
  /** Any of them, matched whole, blind to accents and case. */
  specializations?: readonly string[];
  /** Coaches of any of these categories. */
  categoryIds?: readonly string[];
  minYears?: number;
  sort?: CoachDirectorySort;
}

/** A city or specialization the directory's filter sheet offers. */
export interface CoachFacet {
  /** The spelling most coaches use. */
  label: string;
  /** How many coaches in the whole directory. */
  count: number;
}

/** `GET /profile/instructors/directory/facets`, the most common first. */
export interface CoachDirectoryFacets {
  cities: CoachFacet[];
  specializations: CoachFacet[];
}

export interface PublicInstructorProfile {
  id: string;
  userId: string;
  handle: string | null;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  bio: string | null;
  specializations: string[];
  /** What they coach, ids from `GET /categories` (`CategoryStore`). Older APIs omit it. */
  categoryIds?: string[];
  certifications: InstructorCertification[];
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  isPublic: boolean;
  email: string | null;
  phone: string | null;
  city: string | null;
  countryCode: string | null;
  language: string | null;
  timezone: string | null;
  socialLinks: Record<string, string> | null;
  showEmail: boolean;
  showPhone: boolean;
  joinedAt: string;
  rating: { average: number; total: number } | null;
  venues: PublicVenue[];
}

/** Venue kinds — mirrors the API `VenueKind` enum. */
export type PublicVenueKind =
  | 'GYM'
  | 'STUDIO'
  | 'PARK'
  | 'OUTDOOR'
  | 'CLIENT_HOME'
  | 'ONLINE'
  | 'OTHER';

/**
 * Public, safe subset of a venue for the profile's "Where I coach" section.
 * No street address or meeting URL — just where and what type.
 */
export interface PublicVenue {
  id: string;
  kind: PublicVenueKind;
  isOnline: boolean;
  name: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
}
