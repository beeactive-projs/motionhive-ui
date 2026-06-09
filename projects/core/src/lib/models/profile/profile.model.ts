import type {
  InstructorProfile,
  UpdateInstructorProfilePayload,
} from './instructor-profile.model';
import { ProfilePrivacy } from './profile.enums';

/**
 * Fields whose visibility the owner can flip in the UI. The server's
 * `UpdatePrivacySettingsDto` accepts exactly these keys; keep the two
 * lists in sync.
 */
export type PrivacyControlledField =
  | 'firstName'
  | 'lastName'
  | 'avatarUrl'
  | 'email'
  | 'phone'
  | 'city'
  | 'language'
  | 'timezone';

export type UserPrivacySettings = Partial<
  Record<PrivacyControlledField, ProfilePrivacy>
>;

/**
 * Per-field defaults applied when the user has no override stored for
 * that field. MUST match the `PRIVACY_DEFAULTS` table on the API
 * (`profile.service.ts`) — both layers fall back to this when a key is
 * missing from the JSONB blob, so a drift would silently change what
 * different audiences see.
 */
export const PROFILE_PRIVACY_DEFAULTS: Record<
  PrivacyControlledField,
  ProfilePrivacy
> = {
  firstName: ProfilePrivacy.Public,
  lastName: ProfilePrivacy.Public,
  avatarUrl: ProfilePrivacy.Public,
  email: ProfilePrivacy.OnlyMe,
  phone: ProfilePrivacy.OnlyMe,
  city: ProfilePrivacy.Public,
  language: ProfilePrivacy.CoachesOnly,
  timezone: ProfilePrivacy.CoachesOnly,
};

/**
 * Returns the effective privacy level for a field. Used by the
 * profile UI's privacy chooser so it doesn't have to inline the
 * default fallback at every call site.
 */
export function resolveFieldPrivacy(
  settings: UserPrivacySettings | null | undefined,
  field: PrivacyControlledField,
): ProfilePrivacy {
  return settings?.[field] ?? PROFILE_PRIVACY_DEFAULTS[field];
}

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
  /** Vanity URL slug; null until the backfill runs / the user claims one. */
  handle: string | null;
  /** Per-field visibility map; missing keys fall back to `PROFILE_PRIVACY_DEFAULTS`. */
  privacySettings: UserPrivacySettings;
  /** Locked decision §19 — client browse gate on the exercise catalog. */
  exerciseCatalogOptIn?: boolean;
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
