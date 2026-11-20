import { describe, expect, it } from 'vitest';

import type { PrescribedExercise, PrescribedSet, ProgramWorkout } from '../models/workout/program.model';
import {
  estimateWorkoutMinutes,
  workoutExerciseCount,
  workoutSetCount,
} from './program-workout.utils';

function set(restAfterSeconds: number | null): PrescribedSet {
  return { restAfterSeconds } as PrescribedSet;
}

function exercise(...sets: PrescribedSet[]): PrescribedExercise {
  return { sets } as PrescribedExercise;
}

function day(
  exercises: PrescribedExercise[] | undefined,
  estimatedDurationMinutes: number | null = null,
): ProgramWorkout {
  return { exercises, estimatedDurationMinutes } as ProgramWorkout;
}

describe('workoutSetCount and workoutExerciseCount', () => {
  it('count across every exercise of the day', () => {
    const workout = day([exercise(set(60), set(60)), exercise(set(90))]);
    expect(workoutSetCount(workout)).toBe(3);
    expect(workoutExerciseCount(workout)).toBe(2);
  });

  it('read a day with no tree as empty', () => {
    expect(workoutSetCount(day(undefined))).toBe(0);
    expect(workoutExerciseCount(day(undefined))).toBe(0);
  });
});

describe('estimateWorkoutMinutes', () => {
  it("takes the coach's own estimate first", () => {
    expect(estimateWorkoutMinutes(day([exercise(set(60))], 50))).toBe(50);
  });

  it('is null with nothing to estimate from', () => {
    expect(estimateWorkoutMinutes(day([]))).toBeNull();
    expect(estimateWorkoutMinutes(day([exercise()]))).toBeNull();
    expect(estimateWorkoutMinutes(day(undefined))).toBeNull();
  });

  it('counts 45 s of work per set plus its rest, to the nearest 5 minutes', () => {
    // 15 sets × (45 + 90) s = 33.75 min, which rounds to 35.
    const sets = Array.from({ length: 15 }, () => set(90));
    expect(estimateWorkoutMinutes(day([exercise(...sets)]))).toBe(35);
  });

  it('assumes a minute of rest where a set sets none', () => {
    // 20 sets × (45 + 60) s = 35 min.
    const sets = Array.from({ length: 20 }, () => set(null));
    expect(estimateWorkoutMinutes(day([exercise(...sets)]))).toBe(35);
    // A zero rest is a rest of zero, not a missing one: 20 × 45 s = 15 min.
    const noRest = Array.from({ length: 20 }, () => set(0));
    expect(estimateWorkoutMinutes(day([exercise(...noRest)]))).toBe(15);
  });

  it('never says less than 5 minutes', () => {
    expect(estimateWorkoutMinutes(day([exercise(set(0))]))).toBe(5);
  });
});
