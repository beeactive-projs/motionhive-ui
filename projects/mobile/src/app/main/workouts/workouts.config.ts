import {
  AssignedWorkout,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogStatus,
  formatTotalDuration,
} from 'core';
import {
  addOutline,
  alertCircleOutline,
  backspaceOutline,
  barbellOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  ellipsisHorizontal,
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
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  ellipsisHorizontal,
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
 * Spine tones for routine rows, rotated by position the way the Discover
 * rails do it. Routines carry no inherent category, so a stable per-index
 * tone is what stops a list of them reading as one grey block.
 */
const ROUTINE_TONES: readonly SpineTone[] = [
  SpineTones.Honey,
  SpineTones.Teal,
  SpineTones.Violet,
  SpineTones.Navy,
  SpineTones.Coral,
];

export function routineTone(index: number): SpineTone {
  return ROUTINE_TONES[index % ROUTINE_TONES.length];
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
      return { label: 'Skipped', tone: BadgeTones.Medium };
    case WorkoutLogStatus.Abandoned:
      return { label: 'Abandoned', tone: BadgeTones.Medium };
    case WorkoutLogStatus.InProgress:
      return { label: 'In progress', tone: BadgeTones.Honey };
    default:
      return null;
  }
}

// ─── Copy ─────────────────────────────────────────────────────────────────

/** "6 exercises · ~55 min · Barbell" — only the parts we actually know. */
export function workoutMetaLine(
  exerciseCount: number | null,
  minutes: number | null,
  equipment?: string | null,
): string {
  const parts: string[] = [];
  if (exerciseCount != null) {
    parts.push(`${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`);
  }
  if (minutes != null) parts.push(`~${minutes} min`);
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
  const parts = [planName, `Week ${weekIndex + 1}`, `Day ${dayIndex + 1}`];
  return parts.filter(Boolean).join(' · ');
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
 * "31m · felt 4/5" — the line under a logged workout's name, on the history
 * list and on a client's training page alike. Silent about anything the
 * session did not record.
 */
export function logMeta(log: WorkoutLog): string {
  const parts: string[] = [];
  const duration = workoutDuration(log.durationSeconds);
  if (duration) parts.push(duration);
  if (log.feelingRating) parts.push(`felt ${log.feelingRating}/5`);
  return parts.join(' · ');
}

/** How long the in-progress log has been open, as the resume banner says it. */
export function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}:${String(mins % 60).padStart(2, '0')}`;
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
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(date.getDate()),
  };
}

/** "Fri 12 Sep" — a calendar day as a row says it. */
export function shortDayLabel(when: string): string {
  return calendarDate(when).toLocaleDateString(undefined, {
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
 * The mark on a set's number when it is not a plain working set: "W" for a
 * warm-up, the type's name for the rarer kinds. Nothing for NORMAL and
 * WORKING, which between them are almost every set.
 */
export function setTypeMark(type: ExerciseSetType | null | undefined): string {
  if (!type || type === ExerciseSetType.Normal || type === ExerciseSetType.Working) return '';
  if (type === ExerciseSetType.Warmup) return 'W';
  return type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
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

  const tiles: WorkoutTile[] = [{ label: 'Sets', value: String(sets.length) }];
  if (volume > 0) tiles.push({ label: 'Volume', value: `${Math.round(volume)} kg` });
  if (bodyweightReps > 0) tiles.push({ label: 'Reps', value: String(bodyweightReps) });
  if (holdSeconds > 0) tiles.push({ label: 'Time', value: `${Math.round(holdSeconds / 60)} min` });
  if (distance > 0) tiles.push({ label: 'Distance', value: `${distance} m` });
  return tiles;
}

function loadedVolume(set: LoggedSet): number {
  return set.weightKg != null && set.reps != null ? set.weightKg * set.reps : 0;
}

/**
 * "3 of 4 sets" — what an exercise amounted to, on the summary and on the
 * coach's review alike. A skipped exercise says so rather than "0 of 4":
 * skipping was a decision, and a zero would read as a failure.
 */
export function exerciseSetSummary(exercise: LoggedExercise): string {
  if (exercise.isSkipped) return 'Skipped';
  const sets = exercise.sets ?? [];
  const done = sets.filter((set) => set.isCompleted).length;
  return `${done} of ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
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
    { id: ExerciseActionIds.Swap, label: 'Swap exercise', icon: 'repeat-outline', color: 'medium' },
    {
      id: ExerciseActionIds.Skip,
      label: skipped ? 'Unskip exercise' : 'Skip exercise',
      icon: 'play-skip-forward-outline',
      color: 'medium',
    },
    {
      id: ExerciseActionIds.Remove,
      label: 'Remove from workout',
      icon: 'trash-outline',
      color: 'danger',
      destructive: true,
    },
  ];
}
