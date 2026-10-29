import { ProfilePrivacy } from 'core';

/**
 * The levels a person can pick for a workout, and for new workouts on the
 * Privacy screen: the profile privacy levels, so the app says them the
 * same way everywhere. Public puts it in the Workouts section of their
 * profile, as a summary with no note and no weights.
 */
export const WORKOUT_VISIBILITY_LEVELS: readonly ProfilePrivacy[] = [
  ProfilePrivacy.OnlyMe,
  ProfilePrivacy.CoachesOnly,
  ProfilePrivacy.Public,
];

/** The line under each level, said the way a workout means it. */
export function workoutVisibilityHint(level: ProfilePrivacy): string {
  return `workoutVisibility.hint.${level}`;
}
