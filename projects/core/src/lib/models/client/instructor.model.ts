import { User } from '../user/user.model';
import { InstructorCertification } from '../profile/instructor-profile.model';
import { CoachSuggestionReason } from './client.enums';

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
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  city: string | null;
  country: string | null;
  socialLinks: Record<string, string> | null;
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
