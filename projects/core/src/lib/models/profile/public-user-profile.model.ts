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
export type PublicProfileAudience = 'OWNER' | 'COACH' | 'PUBLIC';

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
}
