import { ProfileWorkout, translate } from 'core';
import { ellipsisHorizontal, flagOutline, lockClosedOutline } from 'ionicons/icons';

/** Every icon this screen renders, registered in one place. */
export const PROFILE_WORKOUT_ICONS = {
  ellipsisHorizontal,
  flagOutline,
  lockClosedOutline,
};

export interface ProfileWorkoutTile {
  label: string;
  value: string;
}

/**
 * What the workout amounted to, one tile per figure it has: an unknown
 * duration or a session with no record leaves its tile out rather than
 * showing a dash or a zero.
 */
export function profileWorkoutTiles(
  workout: Pick<ProfileWorkout, 'durationSeconds' | 'setsCompleted' | 'recordCount'>,
  formatMinutes: (minutes: number) => string,
): ProfileWorkoutTile[] {
  const tiles: ProfileWorkoutTile[] = [];
  const seconds = workout.durationSeconds ?? 0;
  if (seconds >= 60) {
    tiles.push({ label: translate('workouts.tiles.duration'), value: formatMinutes(seconds / 60) });
  }
  if (workout.setsCompleted > 0) {
    tiles.push({ label: translate('workouts.tiles.sets'), value: String(workout.setsCompleted) });
  }
  if (workout.recordCount > 0) {
    tiles.push({ label: translate('person.workout.records'), value: String(workout.recordCount) });
  }
  return tiles;
}
