import { ProfilePrivacy } from 'core';

/**
 * The levels a person can pick for a workout, and for new workouts on the
 * Privacy screen: the profile privacy levels, so the app says them the
 * same way everywhere. Public is left out until public workouts have
 * somewhere to appear (the profile's Workouts section); offering it now
 * would promise something the app does not do yet.
 */
export const WORKOUT_VISIBILITY_LEVELS: readonly ProfilePrivacy[] = [
  ProfilePrivacy.OnlyMe,
  ProfilePrivacy.CoachesOnly,
];

/** The line under each level, said the way a workout means it. */
export function workoutVisibilityHint(level: ProfilePrivacy): string {
  return `workoutVisibility.hint.${level}`;
}
