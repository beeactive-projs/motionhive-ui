import type {
  InstructorProfile,
  UpdateInstructorProfilePayload,
} from './instructor-profile.model';

export interface AccountInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  language: string | null;
  timezone: string | null;
  /** ISO 3166-1 alpha-2 country code (e.g. 'RO'). */
  countryCode: string | null;
  city: string | null;
  createdAt: string;
}

export interface MyProfile {
  account: AccountInfo;
  roles: string[];
  /** Null when the user hasn't activated an instructor profile. */
  instructorProfile: InstructorProfile | null;
}

/**
 * Fields a user can PATCH on `/profile/me`. Country / city live on
 * the account, not on instructor_profile.
 */
export interface UpdateMyProfilePayload {
  account?: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    avatarId?: string;
    language?: string;
    timezone?: string;
    countryCode?: string | null;
    city?: string | null;
  };
  instructor?: UpdateInstructorProfilePayload;
}
