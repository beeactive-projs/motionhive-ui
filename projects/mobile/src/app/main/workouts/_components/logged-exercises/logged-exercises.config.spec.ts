import { describe, expect, it } from 'vitest';

import { ExerciseProgress, ExerciseSetType, LoggedExercise, LoggedSet, PersonalRecord } from 'core';

import { ExerciseActionIds, exerciseActions } from '../../workouts.config';
import {
  compareWithLastTime,
  exerciseHistoryLink,
  exerciseLine,
  previousSession,
  recordFor,
  setLines,
  setValue,
  topSet,
} from './logged-exercises.config';

type Session = ExerciseProgress['sessions'][number];

let seq = 0;
const set = (fields: Partial<LoggedSet>): LoggedSet => ({
  id: `set-${seq++}`,
  loggedExerciseId: 'le-1',
  assignedSetId: null,
  orderIndex: seq,
  setType: 'NORMAL' as ExerciseSetType,
  reps: null,
  weightKg: null,
  durationSeconds: null,
  distanceMeters: null,
  rpe: null,
  rir: null,
  restAfterSeconds: null,
  isCompleted: true,
  completedAt: null,
  notes: null,
  ...fields,
});

const exercise = (sets: LoggedSet[], fields: Partial<LoggedExercise> = {}): LoggedExercise => ({
  id: 'le-1',
  workoutLogId: 'log-2',
  exerciseId: 'bench',
  assignedExerciseId: null,
  orderIndex: 0,
  exerciseNameSnapshot: 'Bench press',
  exerciseThumbnailUrlSnapshot: null,
  notes: null,
  isSkipped: false,
  swappedFromExerciseId: null,
  sets,
  ...fields,
});

const session = (id: string, performedAt: string, fields: Partial<Session> = {}): Session => ({
  workoutLogId: id,
  performedAt,
  workoutName: 'Push day',
  setCount: 3,
  topWeightKg: 60,
  topReps: 8,
  bestDurationSeconds: null,
  bestDistanceMeters: null,
  ...fields,
});

const log = { id: 'log-2', startedAt: '2026-10-29T08:00:00Z', completedAt: '2026-10-29T09:00:00Z' };
const day = (iso: string) => iso.slice(5, 10);

describe('logged exercises', () => {
  // The heaviest set wins and more reps break a tie, as the history page
  // names a session's top set; without weight, the most reps or the longest.
  it('picks the top set', () => {
    expect(topSet([set({ weightKg: 60, reps: 8 }), set({ weightKg: 62.5, reps: 6 }), set({ weightKg: 62.5, reps: 7 })]))
      .toEqual({ weightKg: 62.5, reps: 7, durationSeconds: null, distanceMeters: null });
    expect(topSet([set({ reps: 12 }), set({ reps: 15 })])?.reps).toBe(15);
    expect(topSet([set({ durationSeconds: 45 }), set({ durationSeconds: 60 })])?.durationSeconds).toBe(60);
    expect(topSet([])).toBeNull();
  });

  it('writes a set the way its exercise records it', () => {
    expect(setValue(set({ weightKg: 62.5, reps: 7 }))).toBe('62.5 kg × 7');
    expect(setValue(set({ reps: 12 }))).toBe('12 reps');
    expect(setValue(set({ durationSeconds: 90 }))).toBe('1:30');
    expect(setValue(set({ distanceMeters: 400, durationSeconds: 105 }))).toBe('400 m · 1:45');
    expect(setValue(set({}))).toBe('');
  });

  // The record's own set wears the badge, once, even if a later set repeats
  // the same numbers; an unticked set never does.
  it('numbers the sets and marks the record set once', () => {
    const sets = [
      set({ weightKg: 60, reps: 8 }),
      set({ weightKg: 62.5, reps: 7 }),
      set({ weightKg: 62.5, reps: 7 }),
      set({ weightKg: 65, reps: 5, isCompleted: false }),
    ];
    const record = { exerciseId: 'bench', setWeightKg: 62.5, setReps: 7 } as PersonalRecord;
    const lines = setLines(exercise(sets), record);
    expect(lines.map((line) => [line.number, line.record, line.done])).toEqual([
      [1, false, true],
      [2, true, true],
      [3, false, true],
      [4, false, false],
    ]);
    expect(recordFor(exercise(sets), [record])).toBe(record);
    expect(recordFor(exercise(sets, { exerciseId: null }), [record])).toBeNull();
  });

  it('sums an exercise up in the history page words', () => {
    expect(exerciseLine(exercise([set({ weightKg: 60, reps: 8 }), set({ weightKg: 62.5, reps: 7 })])))
      .toBe('2 sets · top 62.5 × 7');
    expect(exerciseLine(exercise([set({ reps: 12, isCompleted: false })]))).toBe('0 of 1 set');
    expect(exerciseLine(exercise([], { isSkipped: true }))).toBe('Skipped');
  });

  // Newest first: the session after this workout's own row; a workout not in
  // the list compares with the newest one older than it.
  it('finds the session before this workout', () => {
    const sessions = [session('log-3', '2026-10-31T08:00:00Z'), session('log-2', '2026-10-29T08:30:00Z'), session('log-1', '2026-10-25T08:00:00Z')];
    expect(previousSession(sessions, log)?.workoutLogId).toBe('log-1');
    expect(previousSession(sessions.filter((s) => s.workoutLogId !== 'log-2'), log)?.workoutLogId).toBe('log-1');
    expect(previousSession([session('log-2', '2026-10-29T08:30:00Z')], log)).toBeNull();
  });

  it('says how the top set compares with last time', () => {
    const now = exercise([set({ weightKg: 62.5, reps: 7 })]);
    const before = (fields: Partial<Session>) => [session('log-2', '2026-10-29T08:30:00Z'), session('log-1', '2026-10-25T08:00:00Z', fields)];
    expect(compareWithLastTime(now, log, before({ topWeightKg: 60, topReps: 8 }), day)).toEqual({
      verdict: '+2.5 kg vs last time',
      lastTime: 'Last time, 10-25: 60 kg × 8',
    });
    expect(compareWithLastTime(now, log, before({ topWeightKg: 65, topReps: 5 }), day)?.verdict).toBe('2.5 kg lighter than last time');
    expect(compareWithLastTime(now, log, before({ topWeightKg: 62.5, topReps: 5 }), day)?.verdict).toBe('+2 reps vs last time');
    expect(compareWithLastTime(now, log, before({ topWeightKg: 62.5, topReps: 8 }), day)?.verdict).toBe('1 rep fewer than last time');
    expect(compareWithLastTime(now, log, before({ topWeightKg: 62.5, topReps: 7 }), day)?.verdict).toBe('Same as last time');
    expect(compareWithLastTime(now, log, [session('log-2', '2026-10-29T08:30:00Z')], day)).toEqual({
      verdict: 'First time on this exercise',
      lastTime: null,
    });
    const hold = exercise([set({ durationSeconds: 75 })]);
    expect(compareWithLastTime(hold, log, before({ topWeightKg: null, topReps: null, bestDurationSeconds: 60 }), day)?.verdict)
      .toBe('+0:15 vs last time');
    // Nothing done on it: nothing to compare.
    expect(compareWithLastTime(exercise([set({ reps: 8, isCompleted: false })]), log, before({}), day)).toBeNull();
  });

  // The trainee's own history in the stack the workout is in; a coach's in
  // their own stack, under the client.
  it('links to the history in the right stack', () => {
    expect(exerciseHistoryLink('/tabs/home/finish/log-2', 'bench', null)).toEqual(['/tabs/home', 'progress', 'bench']);
    expect(exerciseHistoryLink('/tabs/workouts/finish/log-2', 'bench', null)).toEqual(['/tabs/workouts', 'progress', 'bench']);
    expect(exerciseHistoryLink('/tabs/clients/log/log-2', 'bench', 'anna')).toEqual(['/tabs/clients', 'anna', 'progress', 'bench']);
    expect(exerciseHistoryLink('/tabs/home/log/log-2', 'bench', 'anna')).toEqual(['/tabs/home', 'client', 'anna', 'progress', 'bench']);
    expect(exerciseHistoryLink('/tabs/programs/log/log-2', 'bench', 'anna')).toEqual(['/tabs/programs', 'client', 'anna', 'progress', 'bench']);
  });

  it('offers the history first in the logger, only for a catalog exercise', () => {
    expect(exerciseActions(false).map((action) => action.id)[0]).toBe(ExerciseActionIds.History);
    expect(exerciseActions(false, false).map((action) => action.id)).not.toContain(ExerciseActionIds.History);
  });
});
