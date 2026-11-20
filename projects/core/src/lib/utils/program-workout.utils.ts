import type { ProgramWorkout } from '../models/workout/program.model';

/** The work one set takes, roughly, when the coach gave the day no length. */
const WORK_SECONDS_PER_SET = 45;

/** The rest assumed after a set that sets none. */
const DEFAULT_REST_SECONDS = 60;

/** Estimates land on this step, so they read "~55 min" and never "~53 min". */
const ESTIMATE_STEP_MINUTES = 5;

type WorkoutShape = Pick<ProgramWorkout, 'estimatedDurationMinutes' | 'exercises'>;

/** Sets prescribed across a whole program day. */
export function workoutSetCount(workout: WorkoutShape): number {
  let count = 0;
  for (const exercise of workout.exercises ?? []) {
    count += (exercise.sets ?? []).length;
  }
  return count;
}

/** Exercises prescribed on a program day. */
export function workoutExerciseCount(workout: WorkoutShape): number {
  return (workout.exercises ?? []).length;
}

/**
 * How long a program day takes, in minutes, for the builders (web's rail and
 * editor, mobile's day rows). The coach's own estimate wins; otherwise about
 * 45 s of work per set plus its rest (a minute when it sets none), rounded to
 * the nearest 5 minutes and never under 5. Null when there is nothing to
 * estimate from, so callers leave the figure out.
 */
export function estimateWorkoutMinutes(workout: WorkoutShape): number | null {
  if (workout.estimatedDurationMinutes) {
    return workout.estimatedDurationMinutes;
  }
  if (workoutSetCount(workout) === 0) {
    return null;
  }

  let seconds = 0;
  for (const exercise of workout.exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      let rest = DEFAULT_REST_SECONDS;
      if (set.restAfterSeconds !== null && set.restAfterSeconds !== undefined) {
        rest = set.restAfterSeconds;
      }
      seconds += WORK_SECONDS_PER_SET + rest;
    }
  }
  const rounded = Math.round(seconds / 60 / ESTIMATE_STEP_MINUTES) * ESTIMATE_STEP_MINUTES;
  return Math.max(ESTIMATE_STEP_MINUTES, rounded);
}
