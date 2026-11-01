import { describe, expect, it } from 'vitest';

import { ProgressRecord, SessionTopSet, TrainedExercise } from 'core';

import {
  ProgressTrends,
  latestSetRecord,
  matchingExercises,
  sessionScore,
  sparkOf,
  trainedExerciseLine,
  trendLabel,
  trendOf,
} from './progress-exercises.config';

const lift = (topWeightKg: number, topReps: number): SessionTopSet => ({
  topWeightKg,
  topReps,
  bestDurationSeconds: null,
  bestDistanceMeters: null,
});
const hold = (bestDurationSeconds: number): SessionTopSet => ({
  topWeightKg: null,
  topReps: null,
  bestDurationSeconds,
  bestDistanceMeters: null,
});

describe('progress exercises', () => {
  // A heavier triple and a lighter set of eight compare by estimated max,
  // the way the records do; a hold by its time.
  it('scores a session by what it holds', () => {
    expect(sessionScore(lift(100, 1))).toBe(100);
    expect(sessionScore(lift(60, 6))).toBe(72);
    expect(sessionScore(hold(90))).toBe(90);
    expect(sessionScore({ topWeightKg: null, topReps: 15, bestDurationSeconds: null, bestDistanceMeters: null })).toBe(15);
  });

  // Newest first: the latest session against the average before it.
  it('reads the trend from the latest session', () => {
    expect(trendOf([lift(65, 6), lift(62.5, 6), lift(60, 6)])).toBe(ProgressTrends.Up);
    expect(trendOf([lift(55, 6), lift(62.5, 6), lift(60, 6)])).toBe(ProgressTrends.Down);
    expect(trendOf([lift(61, 6), lift(62.5, 6), lift(60, 6)])).toBe(ProgressTrends.Steady);
    expect(trendOf([hold(75), hold(60)])).toBe(ProgressTrends.Up);
    expect(trendOf([lift(60, 6)])).toBeNull();
  });

  it('draws the sessions oldest to newest', () => {
    expect(sparkOf([lift(65, 6), lift(60, 6)])).toBe('0,36 100,4');
    expect(sparkOf([lift(60, 6), lift(60, 6)])).toBe('0,20 100,20');
    expect(sparkOf([lift(60, 6)])).toBeNull();
  });

  it('writes the row line and the trend in words', () => {
    const exercise: TrainedExercise = {
      exerciseId: 'bench',
      exerciseName: 'Bench press',
      kind: 'STRENGTH',
      sessionCount: 7,
      lastPerformedAt: '2026-10-28T16:20:00Z',
      recent: [{ ...lift(62.5, 7), workoutLogId: 'log-2', performedAt: '2026-10-28T16:20:00Z' }],
    };
    expect(trainedExerciseLine(exercise)).toBe('62.5 kg × 7 · 28 Oct');
    expect(trendLabel(ProgressTrends.Up, 7)).toBe('Going up');
    expect(trendLabel(null, 1)).toBe('1 session');
  });

  it('finds exercises by name, blind to accents and case', () => {
    const named = (exerciseName: string) => ({ exerciseName }) as TrainedExercise;
    const list = [named('Îndreptări românești'), named('Genuflexiuni cu bara'), named('Tracțiuni')];
    expect(matchingExercises(list, 'indreptari').map((e) => e.exerciseName)).toEqual(['Îndreptări românești']);
    expect(matchingExercises(list, ' TRACTIUNI ')).toHaveLength(1);
    expect(matchingExercises(list, '')).toBe(list);
    expect(matchingExercises(list, 'presa')).toEqual([]);
  });

  // The badge only when the row's own latest session set the record.
  it('badges a record set in the latest session', () => {
    const bench = { exerciseId: 'bench', lastPerformedAt: '2026-10-28T16:20:00Z' } as TrainedExercise;
    const on = (recordedAt: string) => [{ exerciseId: 'bench', recordedAt }] as ProgressRecord[];
    expect(latestSetRecord(bench, on('2026-10-28T16:25:00Z'))).toBe(true);
    expect(latestSetRecord(bench, on('2026-10-21T16:20:00Z'))).toBe(false);
    expect(latestSetRecord(bench, [])).toBe(false);
  });
});
