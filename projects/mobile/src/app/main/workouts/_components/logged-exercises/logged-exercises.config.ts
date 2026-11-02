import {
  ExerciseProgress,
  LoggedExercise,
  LoggedSet,
  PersonalRecord,
  WorkoutLog,
  enumLabel,
  ExerciseSetType,
  RestSources,
  translate,
  WorkoutLogStatus,
} from 'core';

import { clientPath, coachStackOf } from '../../../clients/client-paths';
import { workoutLinks } from '../../../home/home-stack.config';
import { SetBadge, setBadge } from '../../logger/logger-flow';
import { exerciseSessionLine, formatMeasure, secondsToClock, sessionTopValue } from '../../workouts.config';

type ExerciseSession = ExerciseProgress['sessions'][number];

/** The best set of an exercise in one workout, in the history page's terms. */
export interface TopSet {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
}

/** One line under an opened exercise. */
export interface SetLine {
  key: string;
  /** "1", "2": the set's place among the exercise's sets. */
  number: number;
  /** "60 kg × 8", "12 reps", "1:30", "400 m · 1:45"; empty when nothing was typed. */
  value: string;
  done: boolean;
  /** The set that earned the workout's record on this exercise. */
  record: boolean;
  /** Its number, or W / D / F / A for a typed set, as the logger shows it. */
  badge: SetBadge;
  /** "RPE 8 · rest 2:05", "rest ~2:40", "break"; empty when neither was recorded. */
  extras: string;
  /** The person's note on this one set. */
  note: string | null;
}

/** The comparison under an opened exercise: a sentence, and last time's set. */
export interface Comparison {
  /** What changed against last time ("+2.5 kg vs last time"), or "First time". */
  verdict: string;
  /** "Last time, 3 Oct: 60 kg × 8"; null on a first time. */
  lastTime: string | null;
}

const completed = (exercise: LoggedExercise): LoggedSet[] =>
  (exercise.sets ?? []).filter((set) => set.isCompleted);

/**
 * The heaviest set, more reps breaking a tie, the way the history page names
 * a session's top set; for an exercise without weight, the most reps, the
 * longest hold or the furthest distance. Null when nothing was done.
 */
export function topSet(sets: readonly LoggedSet[]): TopSet | null {
  if (sets.length === 0) return null;
  const weighted = sets.filter((set) => set.weightKg != null && set.weightKg > 0);
  if (weighted.length > 0) {
    const best = weighted.reduce((top, set) =>
      set.weightKg! > top.weightKg! || (set.weightKg === top.weightKg && (set.reps ?? 0) > (top.reps ?? 0))
        ? set
        : top,
    );
    return { weightKg: best.weightKg, reps: best.reps, durationSeconds: null, distanceMeters: null };
  }
  const max = (pick: (set: LoggedSet) => number | null) =>
    Math.max(0, ...sets.map((set) => pick(set) ?? 0)) || null;
  return {
    weightKg: null,
    reps: max((set) => set.reps),
    durationSeconds: max((set) => set.durationSeconds),
    distanceMeters: max((set) => set.distanceMeters),
  };
}

/** A set as it reads in a row: weight and reps, reps, distance, time, whichever it holds. */
export function setValue(set: LoggedSet): string {
  const parts: string[] = [];
  if (set.weightKg != null && set.weightKg > 0 && set.reps != null) {
    parts.push(
      translate('workouts.exerciseProgress.setValue', {
        weight: translate('workouts.units.kg', { value: formatMeasure(set.weightKg) }),
        reps: set.reps,
      }),
    );
  } else if (set.reps != null) {
    parts.push(translate('count.reps', { count: set.reps }));
  }
  if (set.distanceMeters != null && set.distanceMeters > 0) {
    parts.push(translate('workouts.units.meters', { value: formatMeasure(set.distanceMeters) }));
  }
  if (set.durationSeconds != null && set.durationSeconds > 0) parts.push(secondsToClock(set.durationSeconds));
  return parts.join(' · ');
}

/** The record the workout set on this exercise, from the owner's read. */
export function recordFor(
  exercise: LoggedExercise,
  records: readonly PersonalRecord[] | undefined,
): PersonalRecord | null {
  if (!exercise.exerciseId) return null;
  return records?.find((record) => record.exerciseId === exercise.exerciseId) ?? null;
}

/** Every set of an opened exercise, numbered, the record's set marked. */
export function setLines(exercise: LoggedExercise, record: PersonalRecord | null): SetLine[] {
  let marked = false;
  return (exercise.sets ?? []).map((set, i) => {
    const isRecord =
      !marked &&
      !!record &&
      set.isCompleted &&
      record.setWeightKg != null &&
      set.weightKg === record.setWeightKg &&
      set.reps === record.setReps;
    if (isRecord) marked = true;
    return {
      key: set.id,
      number: i + 1,
      value: setValue(set),
      done: set.isCompleted,
      record: isRecord,
      badge: setBadge(exercise.sets ?? [], i),
      extras: setExtras(set),
      note: set.notes?.trim() || null,
    };
  });
}

/**
 * What else a set recorded: its effort, and the rest after it as measured,
 * exact ("rest 2:05"), estimated ("rest ~2:40") or a break. A rest from the
 * older logger, which stored the planned rest there, is not shown.
 */
export function setExtras(set: LoggedSet): string {
  const parts: string[] = [];
  if (set.rpe != null) parts.push(translate('workouts.effort.rpe', { value: formatMeasure(Number(set.rpe), 1) }));
  const rest = set.restAfterSeconds;
  switch (set.restSource) {
    case RestSources.Tap:
      if (rest != null) parts.push(translate('workouts.loggedSets.rest', { value: secondsToClock(rest) }));
      break;
    case RestSources.Estimated:
      if (rest != null) parts.push(translate('workouts.loggedSets.restEstimated', { value: secondsToClock(rest) }));
      break;
    case RestSources.Break:
      parts.push(translate('workouts.loggedSets.break'));
      break;
  }
  return parts.join(' · ');
}

/** The working sets: done, and not warm-ups. */
const workingSets = (log: WorkoutLog): LoggedSet[] =>
  (log.exercises ?? [])
    .flatMap((exercise) => exercise.sets ?? [])
    .filter((set) => set.isCompleted && set.setType !== ExerciseSetType.Warmup);

/** What a coach reads first: average effort, working sets, average rest. */
export interface CoachSummary {
  effort: string | null;
  workingSets: number;
  rest: string | null;
}

export function coachSummary(log: WorkoutLog): CoachSummary {
  const working = workingSets(log);
  const efforts = working.map((s) => s.rpe).filter((rpe): rpe is number => rpe != null).map(Number);
  // Averages use measured rests only, exact or estimated; never a break.
  const rests = working
    .filter((s) => s.restSource === RestSources.Tap || s.restSource === RestSources.Estimated)
    .map((s) => s.restAfterSeconds)
    .filter((r): r is number => r != null);
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    effort: efforts.length ? formatMeasure(Math.round(mean(efforts) * 10) / 10, 1) : null,
    workingSets: working.length,
    rest: rests.length ? secondsToClock(Math.round(mean(rests))) : null,
  };
}

/** Effort this high, this often, on one exercise, is worth a word to the coach. */
const HIGH_EFFORT = 9;
const SIGNAL_WINDOW = 4;
const SIGNAL_HITS = 3;

/**
 * The exercise where effort stayed high: 9 or more on 3 of the last 4
 * working sets. A calm signal for the coach, never an alarm. Null when none.
 */
export function highEffortExercise(log: WorkoutLog): string | null {
  for (const exercise of log.exercises ?? []) {
    const rated = (exercise.sets ?? [])
      .filter((s) => s.isCompleted && s.setType !== ExerciseSetType.Warmup && s.rpe != null)
      .slice(-SIGNAL_WINDOW);
    const hits = rated.filter((s) => Number(s.rpe) >= HIGH_EFFORT).length;
    if (rated.length >= SIGNAL_HITS && hits >= SIGNAL_HITS) return exercise.exerciseNameSnapshot;
  }
  return null;
}

/**
 * The closed row's second line, in the history page's words: "3 sets · top
 * 62.5 × 7", "Skipped", or "0 of 3 sets" when nothing was ticked.
 */
export function exerciseLine(exercise: LoggedExercise): string {
  if (exercise.isSkipped) return enumLabel('workoutLogStatus', WorkoutLogStatus.Skipped);
  const done = completed(exercise);
  if (done.length === 0) {
    return translate('workouts.meta.setsDone', { done: 0, total: (exercise.sets ?? []).length });
  }
  const top = topSet(done);
  return exerciseSessionLine({
    workoutLogId: '',
    performedAt: '',
    workoutName: '',
    setCount: done.length,
    topWeightKg: top?.weightKg ?? null,
    topReps: top?.reps ?? null,
    bestDurationSeconds: top?.durationSeconds ?? null,
    bestDistanceMeters: top?.distanceMeters ?? null,
  });
}

/**
 * The session before this workout in the exercise's history (newest first):
 * the one after this workout's own row, or, when the workout is not in the
 * list, the newest one older than it.
 */
export function previousSession(
  sessions: readonly ExerciseSession[],
  log: Pick<WorkoutLog, 'id' | 'startedAt' | 'completedAt'>,
): ExerciseSession | null {
  const index = sessions.findIndex((session) => session.workoutLogId === log.id);
  if (index >= 0) return sessions[index + 1] ?? null;
  const at = new Date(log.completedAt ?? log.startedAt).getTime();
  return sessions.find((session) => new Date(session.performedAt).getTime() < at) ?? null;
}

/** The difference in one measure, as the verdict's key and its value. */
function verdictOf(top: TopSet, before: ExerciseSession): string {
  const key = (name: string, params: Record<string, unknown>) =>
    translate(`workouts.loggedSets.compare.${name}`, params);
  if (top.weightKg != null && before.topWeightKg != null && before.topWeightKg > 0) {
    const diff = Math.round((top.weightKg - before.topWeightKg) * 100) / 100;
    if (diff > 0) return key('heavier', { weight: formatMeasure(diff) });
    if (diff < 0) return key('lighter', { weight: formatMeasure(-diff) });
  }
  if (top.distanceMeters != null && before.bestDistanceMeters) {
    const diff = top.distanceMeters - before.bestDistanceMeters;
    const value = translate('workouts.units.meters', { value: formatMeasure(Math.abs(diff)) });
    if (diff > 0) return key('more', { value });
    if (diff < 0) return key('less', { value });
    return key('same', {});
  }
  if (top.durationSeconds != null && before.bestDurationSeconds) {
    const diff = top.durationSeconds - before.bestDurationSeconds;
    const value = secondsToClock(Math.abs(diff));
    if (diff > 0) return key('more', { value });
    if (diff < 0) return key('less', { value });
    return key('same', {});
  }
  const reps = (top.reps ?? 0) - (before.topReps ?? 0);
  if (reps > 0) return key('moreReps', { count: reps });
  if (reps < 0) return key('fewerReps', { count: -reps });
  return key('same', {});
}

/**
 * How this workout's top set compares with the session before it. Null when
 * nothing was done on the exercise, so there is nothing to compare.
 */
export function compareWithLastTime(
  exercise: LoggedExercise,
  log: Pick<WorkoutLog, 'id' | 'startedAt' | 'completedAt'>,
  sessions: readonly ExerciseSession[],
  dayLabel: (iso: string) => string,
): Comparison | null {
  const top = topSet(completed(exercise));
  if (!top || exercise.isSkipped) return null;
  const before = previousSession(sessions, log);
  if (!before) return { verdict: translate('workouts.loggedSets.compare.first'), lastTime: null };
  const value = sessionTopValue(before);
  return {
    verdict: verdictOf(top, before),
    lastTime: value
      ? translate('workouts.loggedSets.lastTime', { date: dayLabel(before.performedAt), value })
      : null,
  };
}

/**
 * Where "Exercise history" goes: the trainee's own exercise page in the
 * stack the workout is in (Home or Workouts), or, for a coach reading a
 * client's workout, that client's exercise page in the coach's stack.
 */
export function exerciseHistoryLink(url: string, exerciseId: string, clientId: string | null): string[] {
  if (clientId) return [...clientPath(coachStackOf(url), clientId), 'progress', exerciseId];
  return [workoutLinks(url).root, 'progress', exerciseId];
}
