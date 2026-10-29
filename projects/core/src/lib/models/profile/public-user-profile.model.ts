import { PublicProfileAudience } from './profile.enums';
import type { MessageReportCategory } from '../messaging/report.model';

/**
 * Response shape for `GET /profile/users/by-handle/:handle`.
 *
 * The server resolves the audience tier (OWNER / COACH / PUBLIC) from
 * the caller's identity and applies per-field privacy before sending
 * the payload — fields the viewer isn't allowed to see come back as
 * `null`, so the UI just renders whichever values are non-null.
 *
 * `displayRoles` and `memberSince` are always public (with `USER`
 * filtered out), and `isInstructor` is a hint so the UI can decide
 * whether to also fetch the richer instructor public payload (offerings,
 * reviews, …) from the existing instructor-by-handle endpoint.
 */
export interface PublicUserProfile {
  userId: string;
  handle: string;
  audience: PublicProfileAudience;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  countryCode: string | null;
  language: string | null;
  timezone: string | null;
  displayRoles: string[];
  memberSince: string;
  isInstructor: boolean;
  /**
   * Groups the signed-in viewer and this person are both active members of.
   * Empty for a guest or your own profile; absent from an API older than it.
   */
  sharedGroups?: PublicSharedGroup[];
  /**
   * Workouts this viewer may see on the profile (Public ones; a coach also
   * Coaches only). The section is left out at 0. Absent from older APIs.
   */
  workoutCount?: number;
  /**
   * When this person became the viewer's coach; null unless they are the
   * viewer's coach now. Absent from older APIs.
   */
  yourCoachSince?: string | null;
}

/**
 * Whose eyes the owner previews their own profile through: everyone, or
 * their coaches. The server ignores it for anyone but the owner.
 */
export type ProfilePreviewAs = 'PUBLIC' | 'COACH';

/**
 * A workout on someone's profile: a safe summary. Never the private note,
 * weights, the plan behind it or a coach's name.
 */
export interface ProfileWorkout {
  id: string;
  name: string;
  completedAt: string | null;
  durationSeconds: number | null;
  setsCompleted: number;
  recordCount: number;
  shareCaption: string | null;
  /**
   * Whether it has a photo. The bytes come only from the profile's photo
   * endpoint, under the same rule as the workout; the version gives a
   * replaced photo a new address.
   */
  hasPhoto: boolean;
  photoVersion: number | null;
}

/** Reporting a workout on a profile: a message report's categories. */
export interface ReportWorkoutPayload {
  category: MessageReportCategory;
  notes?: string;
}

/** One group in common — enough to name it. */
export interface PublicSharedGroup {
  id: string;
  name: string;
  logoUrl: string | null;
}
