import {
  AssignedWorkout,
  ExerciseProgress,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  OneRepMaxSource,
  ProgramAssignmentKind,
  ProgressRange,
  SetField,
  SetFields,
  TrainingDayPlan,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogStatus,
  appLocale,
  dayFromKey,
  enumLabel,
  formatTotalDuration,
  localDayKey,
  startOfDay,
  startOfMonth,
  translate,
} from 'core';
import {
  addOutline,
  alertCircleOutline,
  backspaceOutline,
  barbellOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBack,
  chevronDownOutline,
  chevronForward,
  chevronUpOutline,
  ellipsisHorizontal,
  ellipsisVertical,
  eyeOutline,
  flashOutline,
  playOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  timeOutline,
  trashOutline,
  trendingUpOutline,
} from 'ionicons/icons';

import { SpineTone, SpineTones } from '../../_shared/models/spine-tone.model';
import { BadgeTone, BadgeTones } from '../exercises/exercises.config';

/**
 * Every icon the workouts screens render. An unregistered name draws a blank
 * box with no error, so this list is the single place they are declared and
 * `workouts.config.spec.ts` checks it against every template.
 */
export const WORKOUT_ICONS = {
  addOutline,
  alertCircleOutline,
  backspaceOutline,
  barbellOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBack,
  chevronDownOutline,
  chevronForward,
  chevronUpOutline,
  ellipsisHorizontal,
  ellipsisVertical,
  eyeOutline,
  flashOutline,
  playOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  timeOutline,
  trashOutline,
  trendingUpOutline,
};

/**
 * How many empty sets a freshly added exercise starts with. The API creates
 * the exercise row and no sets, which leaves a header with nothing under it
 * and a tap needed before you can log anything. Three is the consensus
 * default across the trackers this was researched against — and the same
 * number whether the exercise lands in a live workout, a routine or a
 * program day, so the three builders cannot drift.
 */
export const DEFAULT_SETS = 3;

// ─── Spine tones ──────────────────────────────────────────────────────────

/**
 * The hexagon tile behind each routine row, yours or a starter. Ionic palette
 * names with a `-wash` step, rotated by position the way the Discover rails
 * do it: routines carry no inherent category, so a stable per-index colour
 * is what stops a list of them reading as one grey block.
 */
const ROUTINE_TILE_COLORS = ['primary', 'teal', 'info', 'coral'] as const;

export function routineTileColor(index: number): string {
  return ROUTINE_TILE_COLORS[index % ROUTINE_TILE_COLORS.length];
}

/**
 * A logged workout's spine: emerald for a finished session, honey for one
 * still open, and the muted record tone for a skip or an abandoned attempt.
 * A skip is a decision the user made, so it stays visible and quiet rather
 * than disappearing or shouting.
 */
export function logTone(log: WorkoutLog): SpineTone {
  switch (log.status) {
    case WorkoutLogStatus.Completed:
      return SpineTones.Booked;
    case WorkoutLogStatus.InProgress:
      return SpineTones.Honey;
    default:
      return SpineTones.Muted;
  }
}

/** A planned day's spine: done, skipped, or still to do. */
export function assignedDayTone(day: AssignedWorkout): SpineTone {
  switch (day.status) {
    case WorkoutLogStatus.Completed:
      return SpineTones.Booked;
    case WorkoutLogStatus.Skipped:
      return SpineTones.Muted;
    default:
      return SpineTones.Honey;
  }
}

/**
 * The chip on a history row. Completed is silent — it is what almost every
 * row is, and a chip on every row is a chip that says nothing. Only the
 * exceptions speak, in the neutral wash: none of these is something to press.
 */
export function logChip(log: WorkoutLog): { label: string; tone: BadgeTone } | null {
  switch (log.status) {
    case WorkoutLogStatus.Skipped:
    case WorkoutLogStatus.Abandoned:
      return { label: enumLabel('workoutLogStatus', log.status), tone: BadgeTones.Medium };
    case WorkoutLogStatus.InProgress:
      return { label: enumLabel('workoutLogStatus', log.status), tone: BadgeTones.Honey };
    default:
      return null;
  }
}

/** Where a logged workout came from, as far as the history row tells it. */
export const LogSources = {
  Coach: 'coach',
  Self: 'self',
} as const;

export type LogSource = (typeof LogSources)[keyof typeof LogSources];

/**
 * A coach assignment is the only source a row names. Routines, freestyle
 * sessions and plans you scheduled yourself are the default and stay silent,
 * for the same reason Completed carries no chip. An assignment without a kind
 * comes from an API that predates the field and was always a coach's.
 */
export function logSource(log: WorkoutLog): LogSource {
  const assignment = log.assignment;
  if (!assignment || assignment.assignmentKind === ProgramAssignmentKind.Self) {
    return LogSources.Self;
  }
  return LogSources.Coach;
}

// ─── Copy ─────────────────────────────────────────────────────────────────

/** "6 exercises · ~55 min · Barbell" — only the parts we actually know. */
export function workoutMetaLine(
  exerciseCount: number | null,
  minutes: number | null,
  equipment?: string | null,
): string {
  const parts: string[] = [];
  if (exerciseCount != null) parts.push(translate('count.exercises', { count: exerciseCount }));
  if (minutes != null) parts.push(translate('workouts.meta.aboutMinutes', { minutes }));
  if (equipment) parts.push(equipment);
  return parts.join(' · ');
}

/**
 * "Strength block · Week 3 · Day 2" for the hero eyebrow. Week and day are
 * zero-based on the wire and one-based to a human. Sentence case, like every
 * kicker in the app — the mono face carries the eyebrow, not capitals.
 */
export function planPositionLabel(
  planName: string | null,
  weekIndex: number,
  dayIndex: number,
): string {
  const parts = [
    planName,
    translate('workouts.meta.week', { number: weekIndex + 1 }),
    translate('workouts.meta.day', { number: dayIndex + 1 }),
  ];
  return parts.filter(Boolean).join(' · ');
}

/** What the Workouts hero can offer for its day. */
export const HeroStates = {
  /** Nothing in the way: start it. */
  Ready: 'ready',
  /** Another workout is open, so this one can be looked at, not started. */
  Blocked: 'blocked',
  /** Finished already: its summary is what is left to see. */
  Done: 'done',
  /** Skipped on purpose: still there to look at. */
  Skipped: 'skipped',
} as const;
export type HeroState = (typeof HeroStates)[keyof typeof HeroStates];

/**
 * The day's own outcome wins over an open session elsewhere: a finished day
 * stays finished whatever else is running.
 */
export function heroState(workout: TrainingDayWorkout, blocked: boolean): HeroState {
  if (workout.status === WorkoutLogStatus.Completed) return HeroStates.Done;
  if (workout.status === WorkoutLogStatus.Skipped) return HeroStates.Skipped;
  return blocked ? HeroStates.Blocked : HeroStates.Ready;
}

/**
 * "Week 3 of 12" under a plan's name, or "Starts Mon 12 Oct" before it has.
 * The total only for a coach's plan: a self-scheduled routine rolls on, so
 * its end date is a horizon, not a length.
 */
export function planWeekLabel(plan: TrainingDayPlan, todayKey: string): string {
  const elapsed = daysBetween(plan.startDate, todayKey);
  if (elapsed < 0) {
    return translate('workouts.home.startsOn', { date: shortDayLabel(plan.startDate) });
  }
  const week = Math.floor(elapsed / 7) + 1;
  if (!plan.endDate || plan.assignmentKind === ProgramAssignmentKind.Self) {
    return translate('workouts.meta.week', { number: week });
  }
  const total = Math.max(1, Math.ceil((daysBetween(plan.startDate, plan.endDate) + 1) / 7));
  return translate('workouts.home.weekOf', { week: Math.min(week, total), total });
}

/**
 * "last done Tuesday" for a routine's meta line. Lower case because it
 * follows the exercise count and a separator. Today and yesterday by name,
 * the rest of the past week by weekday, anything older by date.
 */
export function lastDoneLabel(performedAt: string, now: Date): string {
  const dayKey = localDayKey(new Date(performedAt));
  const days = daysBetween(dayKey, localDayKey(now));
  if (days <= 0) return translate('workouts.routineRow.lastDoneToday');
  if (days === 1) return translate('workouts.routineRow.lastDoneYesterday');

  const date = dayFromKey(dayKey);
  const day =
    days < 7
      ? date.toLocaleDateString(appLocale(), { weekday: 'long' })
      : date.toLocaleDateString(appLocale(), {
          day: 'numeric',
          month: 'short',
          ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
        });
  return translate('workouts.routineRow.lastDoneOn', { day });
}

/** Whole calendar days from one `YYYY-MM-DD` to another; rounding absorbs DST. */
function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dayFromKey(toKey).getTime() - dayFromKey(fromKey).getTime()) / 86_400_000);
}

/**
 * The target fields every prescribed set carries. A routine's sets and an
 * assigned day's sets both fit, so one line describes either.
 */
export interface SetTarget {
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetWeightPercent1rm?: number | null;
  /** The %1RM already turned into kilograms, when the API has done it. */
  resolvedWeightKg?: number | null;
}

/**
 * "4 sets · 6–8 reps · 82.5 kg top set" for an exercise row before Start.
 *
 * Reps span the lowest floor to the highest ceiling across the sets. A load
 * that changes from set to set names the heaviest one as the top set; a
 * percentage stands in only when no kilograms are known yet. A set with no
 * reps but a duration is a hold.
 */
export function prescriptionLine(sets: readonly SetTarget[]): string {
  if (!sets.length) return '';
  const parts = [translate('count.sets', { count: sets.length })];

  const floors = present(sets.map((s) => s.targetRepsMin ?? s.targetRepsMax));
  const ceilings = present(sets.map((s) => s.targetRepsMax ?? s.targetRepsMin));
  if (floors.length) {
    const min = Math.min(...floors);
    const max = Math.max(...ceilings);
    parts.push(
      min === max
        ? translate('count.reps', { count: min })
        : translate('workouts.prescription.repsRange', { min, max }),
    );
  } else {
    const holds = present(sets.map((s) => s.targetDurationSeconds));
    if (holds.length) {
      parts.push(translate('workouts.prescription.hold', { seconds: Math.max(...holds) }));
    }
  }

  const loads = present(sets.map((s) => s.resolvedWeightKg ?? s.targetWeightKg)).filter((kg) => kg > 0);
  if (loads.length) {
    const top = Math.max(...loads);
    const varied = loads.length < sets.length || loads.some((kg) => kg !== top);
    parts.push(
      varied
        ? translate('workouts.prescription.topSet', { weight: formatMeasure(top) })
        : translate('workouts.units.kg', { value: formatMeasure(top) }),
    );
  } else {
    const percents = present(sets.map((s) => s.targetWeightPercent1rm ?? null));
    if (percents.length) {
      parts.push(
        translate('workouts.prescription.percent1rm', {
          percent: formatMeasure(Math.max(...percents)),
        }),
      );
    }
  }

  return parts.join(' · ');
}

/**
 * "4 × 6–8 · 82.5 kg": `prescriptionLine` cut to fit a right-aligned column,
 * where "sets", "reps" and "top set" go without saying. Same reading of the
 * sets: rep span from lowest floor to highest ceiling, heaviest load, a
 * percentage only when no kilograms are known.
 */
export function compactPrescription(sets: readonly SetTarget[]): string {
  if (!sets.length) return '';
  const parts: string[] = [];

  const floors = present(sets.map((s) => s.targetRepsMin ?? s.targetRepsMax));
  const ceilings = present(sets.map((s) => s.targetRepsMax ?? s.targetRepsMin));
  const holds = present(sets.map((s) => s.targetDurationSeconds));
  if (floors.length) {
    const min = Math.min(...floors);
    const max = Math.max(...ceilings);
    const reps =
      min === max ? String(min) : translate('workouts.prescription.compactRange', { min, max });
    parts.push(translate('workouts.prescription.compact', { sets: sets.length, reps }));
  } else if (holds.length) {
    parts.push(
      translate('workouts.prescription.compactHold', {
        sets: sets.length,
        seconds: Math.max(...holds),
      }),
    );
  } else {
    parts.push(translate('count.sets', { count: sets.length }));
  }

  const loads = present(sets.map((s) => s.resolvedWeightKg ?? s.targetWeightKg)).filter((kg) => kg > 0);
  const percents = present(sets.map((s) => s.targetWeightPercent1rm ?? null));
  if (loads.length) {
    parts.push(translate('workouts.units.kg', { value: formatMeasure(Math.max(...loads)) }));
  } else if (percents.length) {
    parts.push(
      translate('workouts.prescription.percent1rm', {
        percent: formatMeasure(Math.max(...percents)),
      }),
    );
  }

  return parts.join(' · ');
}

function present(values: readonly (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => v != null);
}

/**
 * A finished workout's length. Delegates to core's formatter so a duration
 * reads the same here as it does on a session.
 */
export function workoutDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  return formatTotalDuration(seconds / 60);
}

/**
 * "31m · 16 sets · felt 4/5" — the line under a logged workout's name, on the
 * history list and on a client's training page alike. Silent about anything
 * the session did not record. Sets are the completed ones the list endpoint
 * eager-loads for exactly this count.
 */
export function logMeta(log: WorkoutLog): string {
  const parts: string[] = [];
  const duration = workoutDuration(log.durationSeconds);
  if (duration) parts.push(duration);
  const sets = completedSetCount(log);
  if (sets > 0) parts.push(translate('count.sets', { count: sets }));
  if (log.feelingRating) parts.push(translate('workouts.meta.felt', { rating: log.feelingRating }));
  return parts.join(' · ');
}

function completedSetCount(log: WorkoutLog): number {
  return (log.exercises ?? [])
    .flatMap((exercise) => exercise.sets ?? [])
    .filter((set) => set.isCompleted).length;
}

/** How long the in-progress log has been open, as the resume banner says it. */
export function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  // Past an hour the seconds stay: "1:05:12", not "1:05", which both reads as
  // minutes and only moves once a minute, so a running clock looks stopped.
  if (hrs > 0) {
    return `${hrs}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * The two-line date rail on a row: weekday over day of month, the way the
 * sessions rows stack time over duration. Takes a calendar day
 * (`yyyy-mm-dd`, read as local midnight — `new Date('2026-09-12')` would
 * read it as UTC and slip a day west of Greenwich) or a full instant.
 */
export function dateRail(when: string): { weekday: string; day: string } {
  const date = calendarDate(when);
  return {
    weekday: date.toLocaleDateString(appLocale(), { weekday: 'short' }),
    day: String(date.getDate()),
  };
}

/** "Fri 12 Sep" — a calendar day as a row says it. */
export function shortDayLabel(when: string): string {
  return calendarDate(when).toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function calendarDate(when: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const [y, m, d] = when.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(when);
}

// ─── History calendar ─────────────────────────────────────────────────────

/** How a day reads on the history calendar. */
export const CalendarDayStates = {
  Coach: 'coach',
  Self: 'self',
  Skipped: 'skipped',
  None: 'none',
  Future: 'future',
} as const;

export type CalendarDayState = (typeof CalendarDayStates)[keyof typeof CalendarDayStates];

export interface CalendarCell {
  /** `yyyy-mm-dd`, local. */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  state: CalendarDayState;
  /** The day's logs a tap can open, newest first. Empty on spill-over days. */
  logIds: string[];
}

/**
 * One day's fill. A finished workout outranks a skipped one, and a coach's
 * plan outranks your own: the calendar shows the most meaningful thing that
 * happened. An open or abandoned log is not history yet, so it counts as
 * nothing.
 */
export function calendarDayState(logs: WorkoutLog[], isFuture: boolean): CalendarDayState {
  if (isFuture) return CalendarDayStates.Future;
  const completed = logs.filter((log) => log.status === WorkoutLogStatus.Completed);
  if (completed.length) {
    return completed.some((log) => logSource(log) === LogSources.Coach)
      ? CalendarDayStates.Coach
      : CalendarDayStates.Self;
  }
  if (logs.some((log) => log.status === WorkoutLogStatus.Skipped)) return CalendarDayStates.Skipped;
  return CalendarDayStates.None;
}

/**
 * The month as 42 cells, Monday first, with the neighbouring months' days
 * filling the edges. Six rows always, like the sessions month sheet: a fixed
 * height stops the page jumping between months. Logs land on their local day,
 * never the UTC one.
 */
export function calendarCells(month: Date, logs: WorkoutLog[], today: Date): CalendarCell[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const todayKey = localDayKey(today);

  const byDay = new Map<string, WorkoutLog[]>();
  const newestFirst = [...logs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  for (const log of newestFirst) {
    const key = localDayKey(new Date(log.startedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), log]);
  }

  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = localDayKey(date);
    const inMonth = date.getMonth() === first.getMonth();
    const dayLogs = inMonth ? (byDay.get(key) ?? []) : [];
    const state = inMonth ? calendarDayState(dayLogs, key > todayKey) : CalendarDayStates.None;
    return {
      key,
      day: date.getDate(),
      inMonth,
      isToday: key === todayKey,
      state,
      logIds:
        state === CalendarDayStates.None || state === CalendarDayStates.Future
          ? []
          : dayLogs.map((log) => log.id),
    };
  });
}

/** "6 done" — finished workouts in the month shown, nothing else. */
export function monthDoneCount(logs: WorkoutLog[], month: Date): number {
  return logs.filter((log) => {
    const at = new Date(log.startedAt);
    return (
      log.status === WorkoutLogStatus.Completed &&
      at.getFullYear() === month.getFullYear() &&
      at.getMonth() === month.getMonth()
    );
  }).length;
}

/**
 * The one week a collapsed calendar keeps: the row holding `focusKey` (today
 * or the day last tapped), else the month's first week.
 */
export function calendarWeek(cells: CalendarCell[], focusKey: string | null): CalendarCell[] {
  const index = cells.findIndex((cell) => cell.inMonth && cell.key === focusKey);
  const row = index < 0 ? 0 : Math.floor(index / 7);
  return cells.slice(row * 7, row * 7 + 7);
}

// ─── Exercise progress ────────────────────────────────────────────────────

type OneRepMaxPoint = ExerciseProgress['oneRepMaxSeries'][number];
type ExerciseSession = ExerciseProgress['sessions'][number];

/** The windows an exercise's progress reads, shortest first. */
export const PROGRESS_RANGES: readonly ProgressRange[] = ['4w', '12w', '1y'];

export const RANGE_DAYS: Record<ProgressRange, number> = { '4w': 28, '12w': 84, '1y': 365 };

/** Local midnight on the first day a range covers, `now` being its last. */
export function rangeStart(range: ProgressRange, now: number): number {
  const start = startOfDay(new Date(now));
  start.setDate(start.getDate() - RANGE_DAYS[range]);
  return start.getTime();
}

/** The items whose local day falls inside the range, its first day included. */
export function inRange<T>(
  items: readonly T[],
  at: (item: T) => string,
  range: ProgressRange,
  now: number,
): T[] {
  const from = rangeStart(range, now);
  return items.filter((item) => calendarDate(at(item)).getTime() >= from);
}

export interface TrendPoint {
  /** Epoch ms. */
  x: number;
  y: number;
}

/**
 * The estimated 1RM across a range, as a line. The API only writes a 1RM
 * when a session beats the best before it, so the series is a staircase:
 * the best carried in from before the range opens the line, and the latest
 * holds until today. A quiet month then reads as flat, not as missing.
 */
export function oneRepMaxPoints(
  series: readonly OneRepMaxPoint[],
  range: ProgressRange,
  now: number,
): TrendPoint[] {
  const from = rangeStart(range, now);
  const timed = series
    .map((point) => ({ x: new Date(point.recordedAt).getTime(), y: point.weightKg }))
    .filter((point) => point.x <= now)
    .sort((a, b) => a.x - b.x);
  const before = timed.filter((point) => point.x < from);
  const inside = timed.filter((point) => point.x >= from);
  const points: TrendPoint[] = [];
  const carried = before.at(-1);
  if (carried) points.push({ x: from, y: carried.y });
  points.push(...inside);
  // A lone first-ever record stays a dot: holding it flat to today would draw
  // a trend out of a single number.
  const last = points.at(-1);
  if (last && last.x < now && (carried || inside.length > 1)) points.push({ x: now, y: last.y });
  return points;
}

/** How far the estimate moved across the range; null when it has no span. */
export function oneRepMaxDelta(
  series: readonly OneRepMaxPoint[],
  range: ProgressRange,
  now: number,
): number | null {
  const points = oneRepMaxPoints(series, range, now);
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].y - points[0].y) * 100) / 100;
}

/**
 * The best top set by estimated 1RM (Epley: weight × (1 + reps / 30)), so
 * 72.5 × 5 outranks 75 × 2. A tie goes to the heavier weight.
 */
export function bestTopSet(
  sessions: readonly ExerciseSession[],
): { weightKg: number; reps: number } | null {
  let best: { weightKg: number; reps: number; score: number } | null = null;
  for (const session of sessions) {
    if (session.topWeightKg == null || session.topReps == null) continue;
    const score = session.topWeightKg * (1 + session.topReps / 30);
    if (!best || score > best.score || (score === best.score && session.topWeightKg > best.weightKg)) {
      best = { weightKg: session.topWeightKg, reps: session.topReps, score };
    }
  }
  return best ? { weightKg: best.weightKg, reps: best.reps } : null;
}

/**
 * Sessions that set a new best. An estimated 1RM row is only ever written
 * when a session beats the previous best, so its day marks the record. A
 * tested or hand-entered 1RM is not something a session did.
 */
export function recordSessionIds(progress: ExerciseProgress): Set<string> {
  const estimated = new Set<string>([
    OneRepMaxSource.EstimatedEpley,
    OneRepMaxSource.EstimatedBrzycki,
  ]);
  const days = new Set(
    progress.oneRepMaxSeries
      .filter((point) => estimated.has(point.source))
      .map((point) => localDayKey(new Date(point.recordedAt))),
  );
  return new Set(
    progress.sessions
      .filter((session) => days.has(localDayKey(new Date(session.performedAt))))
      .map((session) => session.workoutLogId),
  );
}

/**
 * The best a session managed, for exercises judged on something other than
 * load: the longest hold, the furthest distance, or the most reps.
 */
export function sessionBestValue(session: ExerciseSession): string | null {
  if (session.bestDurationSeconds) return secondsToClock(session.bestDurationSeconds);
  if (session.bestDistanceMeters) {
    return translate('workouts.units.meters', { value: formatMeasure(session.bestDistanceMeters) });
  }
  if (session.topReps) return translate('count.reps', { count: session.topReps });
  return null;
}

/** "3 sets · top 72.5 × 5", or "3 sets · best 1:30" for a hold. */
export function exerciseSessionLine(session: ExerciseSession): string {
  const sets = translate('count.sets', { count: session.setCount });
  if (session.topWeightKg != null && session.topReps != null) {
    return translate('workouts.exerciseProgress.sessionLine', {
      sets,
      weight: formatMeasure(session.topWeightKg),
      reps: session.topReps,
    });
  }
  const best = sessionBestValue(session);
  return best ? translate('workouts.exerciseProgress.sessionLineBest', { sets, value: best }) : sets;
}

export interface TrendGeometry {
  /** SVG paths in a 0–100 box, y pointing down; empty for a single point. */
  line: string;
  area: string;
  /** Gridlines top to bottom: the domain's max, middle and min. */
  ticks: { value: number; y: number }[];
  /** Where the latest point sits, in percent of the plot. */
  end: { x: number; y: number };
}

/**
 * A trend line's shape in percent of its plot, so the chart can draw the
 * line in a stretched SVG and place labels and the end dot in HTML, where
 * they keep their proportions. The y domain pads the data by one unit each
 * way so the line never rides an edge.
 */
export function trendGeometry(
  points: readonly TrendPoint[],
  from: number,
  to: number,
): TrendGeometry | null {
  if (!points.length) return null;
  const values = points.map((point) => point.y);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const span = Math.max(to - from, 1);
  const x = (at: number) => round2(((at - from) / span) * 100);
  const y = (value: number) => round2(((hi - value) / (hi - lo)) * 100);

  const coords = points.map((point) => `${x(point.x)} ${y(point.y)}`);
  const line = points.length > 1 ? `M${coords.join(' L')}` : '';
  const area = line ? `${line} L${x(points[points.length - 1].x)} 100 L${x(points[0].x)} 100 Z` : '';
  const mid = Math.round((lo + hi) / 2);
  const last = points[points.length - 1];
  return {
    line,
    area,
    ticks: [hi, mid, lo].map((value) => ({ value, y: y(value) })),
    end: { x: x(last.x), y: y(last.y) },
  };
}

/** `count` instants evenly spread from `from` to `to`, both ends included. */
export function trendTicks(from: number, to: number, count: number): number[] {
  if (count < 2) return [to];
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Set rows ─────────────────────────────────────────────────────────────

/**
 * A duration as a clock. The API stores plain seconds, but nobody reads a
 * ninety-second plank as "90" — they read it as 1:30.
 */
export function secondsToClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  return `${mins}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Digits typed on a keypad, read right to left into seconds — the way every
 * timer input works. "130" is 1:30, i.e. 90 seconds; "45" is 0:45.
 */
export function clockDigitsToSeconds(digits: string): number | null {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return null;
  const padded = clean.padStart(3, '0');
  const secs = Number(padded.slice(-2));
  const mins = Number(padded.slice(0, -2));
  return mins * 60 + secs;
}

/** The same digits, shown back as the clock they are building. */
export function clockDigitsToDisplay(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '0:00';
  const padded = clean.padStart(3, '0');
  return `${Number(padded.slice(0, -2))}:${padded.slice(-2)}`;
}

/**
 * Set types whose mark is a compact form of their own, not the enum's label:
 * "W" for a warm-up, and the short names the set grid has room for.
 */
const SET_TYPE_MARK_KEYS: Partial<Record<ExerciseSetType, string>> = {
  [ExerciseSetType.Warmup]: 'workouts.setTypeMark.WARMUP',
  [ExerciseSetType.Dropset]: 'workouts.setTypeMark.DROPSET',
  [ExerciseSetType.Failure]: 'workouts.setTypeMark.FAILURE',
  [ExerciseSetType.RestPause]: 'workouts.setTypeMark.REST_PAUSE',
};

/**
 * The mark on a set's number when it is not a plain working set: "W" for a
 * warm-up, the type's name for the rarer kinds. Nothing for NORMAL and
 * WORKING, which between them are almost every set.
 */
export function setTypeMark(type: ExerciseSetType | null | undefined): string {
  if (!type || type === ExerciseSetType.Normal || type === ExerciseSetType.Working) return '';
  const key = SET_TYPE_MARK_KEYS[type];
  return key ? translate(key) : enumLabel('exerciseSetType', type);
}

/**
 * A measured number as the reader's locale writes it ("82.5" / "82,5"). No
 * grouping, so a four-digit volume stays "1200" rather than gaining a comma.
 */
export function formatMeasure(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat(appLocale(), {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  }).format(value);
}

/**
 * What the keypad is editing — decides the step size and whether decimals
 * make sense. `Rpe` is a field the log carries but no screen edits yet.
 */
export const KeypadFields = {
  Weight: 'weight',
  Reps: 'reps',
  Duration: 'duration',
  Distance: 'distance',
  Rpe: 'rpe',
} as const;

export type KeypadField = (typeof KeypadFields)[keyof typeof KeypadFields];

// ─── Summary tiles ────────────────────────────────────────────────────────

export interface WorkoutTile {
  label: string;
  value: string;
}

/**
 * The metric tiles for a finished session — only the modalities it actually
 * contained. Volume where something was loaded, reps where it was not, time
 * for holds, distance for cardio. Never one composite number: compositing
 * them is the mistake every app that tried it made.
 *
 * Shared by the trainee's own summary and the coach's read-only review, so
 * the two are always talking about the same numbers.
 */
export function workoutTiles(log: WorkoutLog): WorkoutTile[] {
  const sets = (log.exercises ?? [])
    .flatMap((exercise) => exercise.sets ?? [])
    .filter((set) => set.isCompleted);

  const volume = sets.reduce((sum, set) => sum + loadedVolume(set), 0);
  const bodyweightReps = sets
    .filter((set) => set.weightKg == null && set.reps != null)
    .reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const holdSeconds = sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
  const distance = sets.reduce((sum, set) => sum + (set.distanceMeters ?? 0), 0);

  const tiles: WorkoutTile[] = [
    { label: translate('workouts.tiles.sets'), value: formatMeasure(sets.length) },
  ];
  if (volume > 0) {
    tiles.push({
      label: translate('workouts.tiles.volume'),
      value: translate('workouts.units.kg', { value: formatMeasure(Math.round(volume)) }),
    });
  }
  if (bodyweightReps > 0) {
    tiles.push({ label: translate('workouts.tiles.reps'), value: formatMeasure(bodyweightReps) });
  }
  if (holdSeconds > 0) {
    tiles.push({
      label: translate('workouts.tiles.time'),
      value: translate('time.minutesShort', { minutes: Math.round(holdSeconds / 60) }),
    });
  }
  if (distance > 0) {
    tiles.push({
      label: translate('workouts.tiles.distance'),
      value: translate('workouts.units.meters', { value: formatMeasure(distance) }),
    });
  }
  return tiles;
}

function loadedVolume(set: LoggedSet): number {
  return set.weightKg != null && set.reps != null ? set.weightKg * set.reps : 0;
}

/** Every set ticked, and there was at least one: the exercise folds to a check row. */
export function isExerciseDone(exercise: LoggedExercise): boolean {
  const sets = exercise.sets ?? [];
  return !exercise.isSkipped && sets.length > 0 && sets.every((set) => set.isCompleted);
}

/** Kilograms moved across the completed sets — weight × reps, nothing else counted. */
export function exerciseVolumeKg(exercise: LoggedExercise): number {
  return (exercise.sets ?? [])
    .filter((set) => set.isCompleted)
    .reduce((sum, set) => sum + loadedVolume(set), 0);
}

/**
 * "3 sets done · 2,140 kg" on a folded exercise. Grouped, unlike a single
 * measure: a volume is a total you read at a glance, not a number you type.
 */
export function exerciseDoneSummary(exercise: LoggedExercise): string {
  const done = (exercise.sets ?? []).filter((set) => set.isCompleted).length;
  const parts = [translate('workouts.logger.setsDone', { count: done })];
  const volume = Math.round(exerciseVolumeKg(exercise));
  if (volume > 0) {
    parts.push(
      translate('workouts.units.kg', { value: new Intl.NumberFormat(appLocale()).format(volume) }),
    );
  }
  return parts.join(' · ');
}

/**
 * "80 kg · 8 · 8 · 7" — last time's top weight, then each set's reps, so the
 * line answers "what did I manage" before the grid asks "what now". A hold
 * reads as its clocks instead. Empty when there is no last time.
 */
export function lastTimeSummary(sets: readonly LoggedSet[]): string {
  const done = sets.filter((set) => set.isCompleted);
  const rows = done.length ? done : sets;
  if (!rows.length) return '';

  const weights = rows.map((set) => set.weightKg).filter((kg): kg is number => kg != null && kg > 0);
  const reps = rows.map((set) => set.reps).filter((n): n is number => n != null);
  const parts: string[] = [];
  if (weights.length) {
    parts.push(translate('workouts.units.kg', { value: formatMeasure(Math.max(...weights)) }));
  }
  if (reps.length) {
    parts.push(...reps.map((n) => formatMeasure(n)));
  } else {
    const holds = rows
      .map((set) => set.durationSeconds)
      .filter((s): s is number => s != null)
      .map(secondsToClock);
    parts.push(...holds);
  }
  return parts.join(' · ');
}

/**
 * What an empty cell shows in grey: the coach's target for this set when the
 * plan names one ("6–8", "82.5", the %1RM already in kilograms), otherwise
 * what the same set held last time. Empty when neither exists.
 */
export function setPlaceholder(
  set: LoggedSet,
  field: SetField,
  previous: LoggedSet | null,
): string {
  const target = set.assignedSet;
  switch (field) {
    case SetFields.Weight: {
      const kg = target?.resolvedWeightKg ?? target?.targetWeightKg ?? previous?.weightKg ?? null;
      return kg == null ? '' : formatMeasure(kg);
    }
    case SetFields.Reps: {
      const min = target?.targetRepsMin ?? null;
      const max = target?.targetRepsMax ?? null;
      if (min != null && max != null && min !== max) {
        return translate('workouts.prescription.compactRange', {
          min: formatMeasure(min),
          max: formatMeasure(max),
        });
      }
      const reps = min ?? max ?? previous?.reps ?? null;
      return reps == null ? '' : formatMeasure(reps);
    }
    case SetFields.Duration: {
      const seconds = target?.targetDurationSeconds ?? previous?.durationSeconds ?? null;
      return seconds == null ? '' : secondsToClock(seconds);
    }
    case SetFields.Distance: {
      const meters = target?.targetDistanceMeters ?? previous?.distanceMeters ?? null;
      return meters == null ? '' : formatMeasure(meters);
    }
  }
}

/**
 * "3 of 4 sets" — what an exercise amounted to, on the summary and on the
 * coach's review alike. A skipped exercise says so rather than "0 of 4":
 * skipping was a decision, and a zero would read as a failure.
 */
export function exerciseSetSummary(exercise: LoggedExercise): string {
  if (exercise.isSkipped) return enumLabel('workoutLogStatus', WorkoutLogStatus.Skipped);
  const sets = exercise.sets ?? [];
  const done = sets.filter((set) => set.isCompleted).length;
  return translate('workouts.meta.setsDone', { done, total: sets.length });
}

/** The emoji scale, as a rating affordance rather than decorative copy. */
export const FEELINGS: readonly { value: number; glyph: string }[] = [
  { value: 1, glyph: '😣' },
  { value: 2, glyph: '😕' },
  { value: 3, glyph: '😐' },
  { value: 4, glyph: '🙂' },
  { value: 5, glyph: '💪' },
];

// ─── Exercise verbs ───────────────────────────────────────────────────────

/** The verbs for one exercise mid-workout, in priority order, destructive last. */
export const ExerciseActionIds = {
  Swap: 'swap',
  Skip: 'skip',
  Remove: 'remove',
} as const;

export type ExerciseActionId = (typeof ExerciseActionIds)[keyof typeof ExerciseActionIds];

export interface ExerciseAction {
  id: ExerciseActionId;
  /** Translation key — the sheet's template translates it. */
  label: string;
  icon: string;
  /** Ionic palette name for the leading glyph. */
  color: string;
  destructive?: boolean;
}

/**
 * Skip flips to unskip on an exercise already skipped; the other two verbs
 * are the same either way. Removing loses whatever was logged against the
 * exercise, so it reads as the destructive option it is.
 */
export function exerciseActions(skipped: boolean): ExerciseAction[] {
  return [
    {
      id: ExerciseActionIds.Swap,
      label: 'workouts.exerciseActions.swap',
      icon: 'repeat-outline',
      color: 'medium',
    },
    {
      id: ExerciseActionIds.Skip,
      label: skipped ? 'workouts.exerciseActions.unskip' : 'workouts.exerciseActions.skip',
      icon: 'play-skip-forward-outline',
      color: 'medium',
    },
    {
      id: ExerciseActionIds.Remove,
      label: 'workouts.exerciseActions.remove',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    },
  ];
}
