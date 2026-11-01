import {
  ProgressRecord,
  SessionTopSet,
  TrainedExercise,
  appLocale,
  foldForSearch,
  localDayKey,
  translate,
} from 'core';

import { sessionTopValue } from '../../workouts.config';

/** How many exercises the list shows at first, and how many each "Show more" adds. */
export const EXERCISES_PAGE = 8;

/**
 * The exercises whose name holds the typed words, blind to accents and case
 * ("indreptari" finds "Îndreptări"); every one, in order, for an empty query.
 * The list is whole on the phone, so this runs here rather than in the API.
 */
export function matchingExercises(
  exercises: readonly TrainedExercise[],
  query: string,
): readonly TrainedExercise[] {
  const words = foldForSearch(query.trim());
  if (!words) return exercises;
  return exercises.filter((exercise) => foldForSearch(exercise.exerciseName).includes(words));
}

/** Within this much of the sessions before it, the latest one reads as steady. */
const STEADY_BAND = 0.02;

export const ProgressTrends = {
  Up: 'up',
  Steady: 'steady',
  Down: 'down',
} as const;

export type ProgressTrend = (typeof ProgressTrends)[keyof typeof ProgressTrends];

/**
 * One session as a single comparable number: the estimated 1-rep max
 * (Epley, as the records use) for a loaded set, else the longest hold, the
 * furthest distance or the most reps. Null when the session holds none.
 */
export function sessionScore(top: SessionTopSet): number | null {
  if (top.topWeightKg != null && top.topWeightKg > 0) {
    const reps = top.topReps ?? 1;
    return reps <= 1 ? top.topWeightKg : top.topWeightKg * (1 + reps / 30);
  }
  if (top.bestDurationSeconds) return top.bestDurationSeconds;
  if (top.bestDistanceMeters) return top.bestDistanceMeters;
  return top.topReps ?? null;
}

const scores = (recent: readonly SessionTopSet[]): number[] =>
  recent.map(sessionScore).filter((score): score is number => score != null);

/**
 * Where the exercise is heading: the latest session (the list is newest
 * first) against the average of the ones before it. Null with one session,
 * when there is nothing to compare.
 */
export function trendOf(recent: readonly SessionTopSet[]): ProgressTrend | null {
  const [latest, ...before] = scores(recent);
  if (latest == null || before.length === 0) return null;
  const average = before.reduce((sum, score) => sum + score, 0) / before.length;
  if (latest > average * (1 + STEADY_BAND)) return ProgressTrends.Up;
  if (latest < average * (1 - STEADY_BAND)) return ProgressTrends.Down;
  return ProgressTrends.Steady;
}

/**
 * The sessions as an SVG polyline's points in a 100 by 40 box, oldest left,
 * newest right; null under two sessions.
 */
export function sparkOf(recent: readonly SessionTopSet[]): string | null {
  const values = scores(recent).reverse();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const at = (value: number, i: number) => ({
    x: Math.round((i / (values.length - 1)) * 100),
    // 4 to 36: the stroke stays inside the box at both ends.
    y: max === min ? 20 : Math.round(36 - ((value - min) / (max - min)) * 32),
  });
  return values
    .map(at)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}

/** The row's second line: the latest top set and when, "62.5 kg × 7 · 28 Oct". */
export function trainedExerciseLine(exercise: TrainedExercise): string {
  const latest = exercise.recent[0];
  const value = latest ? sessionTopValue(latest) : '';
  const date = new Date(exercise.lastPerformedAt).toLocaleDateString(appLocale(), {
    day: 'numeric',
    month: 'short',
  });
  return value ? translate('workouts.progress.exerciseLine', { value, date }) : date;
}

/** The trend in words, or the session count for a first session. */
export function trendLabel(trend: ProgressTrend | null, sessionCount: number): string {
  return trend
    ? translate(`workouts.progress.trend.${trend}`)
    : translate('workouts.progress.sessions', { count: sessionCount });
}

/**
 * Whether the exercise's latest session set its record: the badge says what
 * the row's line shows. A record from an earlier session beside a lighter
 * latest one would read as a contradiction ("Record", "Going down").
 */
export function latestSetRecord(exercise: TrainedExercise, records: readonly ProgressRecord[]): boolean {
  const record = records.find((r) => r.exerciseId === exercise.exerciseId);
  return !!record && localDayKey(new Date(record.recordedAt)) === localDayKey(new Date(exercise.lastPerformedAt));
}
