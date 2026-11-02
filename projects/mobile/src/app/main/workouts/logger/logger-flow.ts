import {
  AssignedSet,
  ExerciseKind,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  PrescribedSet,
  RestSource,
  RestSources,
  SetField,
  SetFields,
  enumLabel,
  setFieldsFor,
  translate,
} from 'core';

import { formatMeasure, secondsToClock } from '../workouts.config';

/**
 * The logger's flow, as plain functions: which set has the focus, what a set
 * is pre-filled with, what its badge says, how long the rest after it is and
 * whether to ask how hard it was. The page only wires these to the screen.
 *
 * Direction C (Claude Design, Workouts R2): the list stays one scrolling
 * list; finished sets shrink to one line, the set you are on grows into a
 * card with big fields, and the ones ahead read as a grey line.
 */

/** How a set row is drawn. */
export const SetRowModes = {
  /** Ticked: one line. */
  Done: 'done',
  /** The set you are on, or one opened to edit: the big card. */
  Focus: 'focus',
  /** Still ahead: a grey line with what it will be. */
  Future: 'future',
} as const;
export type SetRowMode = (typeof SetRowModes)[keyof typeof SetRowModes];

/** One set, addressed by its exercise and its own id. */
export interface SetRef {
  exerciseId: string;
  setId: string;
}

/** What the plan asks of a set, whichever plan it came from. */
export type PlanSet = Pick<
  AssignedSet & PrescribedSet,
  | 'setType'
  | 'targetRepsMin'
  | 'targetRepsMax'
  | 'targetWeightKg'
  | 'targetDurationSeconds'
  | 'targetDistanceMeters'
  | 'targetRpe'
  | 'targetRir'
  | 'restAfterSeconds'
> & { resolvedWeightKg?: number | null };

/** No plan names a rest and the person has set no default: the common default. */
export const DEFAULT_REST_SECONDS = 90;
/** From a warm-up to the next set, unless the plan says otherwise. */
export const WARMUP_REST_SECONDS = 45;
/** How long the effort question waits before it gets out of the way. */
export const EFFORT_PROMPT_MS = 6000;
/** The effort scale offered after a tick. Below 6 is not worth a tap mid-workout. */
export const EFFORT_CHOICES = [6, 7, 8, 9, 10] as const;

/** A coach plan's targets, else a routine's. */
export function planOf(set: LoggedSet): PlanSet | null {
  return set.assignedSet ?? set.prescribedSet ?? null;
}

/** The plan's note on an exercise, from a coach plan or a routine. */
export function planNoteOf(exercise: LoggedExercise): string {
  return (exercise.assignedExercise?.notes ?? exercise.prescribedExercise?.notes ?? '').trim();
}

/**
 * Exercises as the logger groups them: a superset is the run of consecutive
 * exercises sharing a `supersetGroupId`, lettered A, B, C in the order they
 * appear; every other exercise is a block of its own.
 */
export interface ExerciseBlock {
  exercises: LoggedExercise[];
  /** "A", "B": set on supersets only. */
  letter: string | null;
}

export function exerciseBlocks(exercises: readonly LoggedExercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  let letters = 0;
  for (const exercise of exercises) {
    const group = exercise.supersetGroupId ?? null;
    const last = blocks[blocks.length - 1];
    const lastGroup = last?.exercises[0]?.supersetGroupId ?? null;
    if (group !== null && last && last.letter !== null && lastGroup === group) {
      last.exercises.push(exercise);
      continue;
    }
    blocks.push({ exercises: [exercise], letter: group !== null ? '' : null });
  }
  // A group of one is not a superset (its partner was removed).
  for (const block of blocks) {
    if (block.letter === null) continue;
    block.letter = block.exercises.length > 1 ? String.fromCharCode(65 + letters++) : null;
  }
  return blocks;
}

/** "A1", "A2": a superset member's tag, or null outside a superset. */
export function memberTag(block: ExerciseBlock, exerciseId: string): string | null {
  if (block.letter === null) return null;
  const at = block.exercises.findIndex((e) => e.id === exerciseId);
  return at < 0 ? null : `${block.letter}${at + 1}`;
}

/** How many rounds a superset has: its longest member. */
export function roundCount(block: ExerciseBlock): number {
  return Math.max(0, ...block.exercises.map((e) => (e.sets ?? []).length));
}

/**
 * The order sets are done in. Exercise by exercise, set by set; a superset
 * goes round by round instead (A1, A2, then A1 of the next round), unless
 * `rounds` is off. Skipped exercises are left out; when one member of a
 * superset runs out of sets, the other carries on alone.
 */
export function loggingOrder(exercises: readonly LoggedExercise[], rounds = true): SetRef[] {
  const out: SetRef[] = [];
  for (const block of exerciseBlocks(exercises)) {
    const live = block.exercises.filter((e) => !e.isSkipped);
    if (block.letter === null || !rounds) {
      for (const exercise of live) {
        for (const set of exercise.sets ?? []) out.push({ exerciseId: exercise.id, setId: set.id });
      }
      continue;
    }
    const total = roundCount(block);
    for (let round = 0; round < total; round++) {
      for (const exercise of live) {
        const set = (exercise.sets ?? [])[round];
        if (set) out.push({ exerciseId: exercise.id, setId: set.id });
      }
    }
  }
  return out;
}

/** The first set not yet ticked, in logging order: the one the screen points at. */
export function focusOf(exercises: readonly LoggedExercise[], rounds = true): SetRef | null {
  const sets = new Map(
    exercises.flatMap((exercise) => (exercise.sets ?? []).map((set) => [set.id, set] as const)),
  );
  return loggingOrder(exercises, rounds).find((ref) => !sets.get(ref.setId)?.isCompleted) ?? null;
}

/** The set after `ref` in logging order that is still to do, or null. */
export function nextAfter(
  exercises: readonly LoggedExercise[],
  ref: SetRef,
  rounds = true,
): { exercise: LoggedExercise; set: LoggedSet; index: number } | null {
  const order = loggingOrder(exercises, rounds);
  const at = order.findIndex((r) => r.setId === ref.setId);
  const rest = at >= 0 ? [...order.slice(at + 1), ...order.slice(0, at)] : order;
  for (const r of rest) {
    const exercise = exercises.find((e) => e.id === r.exerciseId);
    const sets = exercise?.sets ?? [];
    const index = sets.findIndex((s) => s.id === r.setId);
    const set = sets[index];
    if (exercise && set && !set.isCompleted) return { exercise, set, index };
  }
  return null;
}

/**
 * Two sets in the same round of the same superset: no rest between them,
 * the round goes straight on to the next exercise.
 */
export function sameRound(
  exercises: readonly LoggedExercise[],
  a: SetRef,
  b: SetRef,
  rounds = true,
): boolean {
  if (!rounds || a.exerciseId === b.exerciseId) return false;
  const block = exerciseBlocks(exercises).find((bl) =>
    bl.exercises.some((e) => e.id === a.exerciseId),
  );
  if (!block || block.letter === null) return false;
  const member = (ref: SetRef) => block.exercises.find((e) => e.id === ref.exerciseId);
  const indexOf = (ref: SetRef) => (member(ref)?.sets ?? []).findIndex((s) => s.id === ref.setId);
  return !!member(b) && indexOf(a) >= 0 && indexOf(a) === indexOf(b);
}

/** Set types that wear a letter instead of a number. */
const LETTER_TYPES = new Set<ExerciseSetType>([
  ExerciseSetType.Warmup,
  ExerciseSetType.Dropset,
  ExerciseSetType.Failure,
  ExerciseSetType.Amrap,
  ExerciseSetType.RestPause,
  ExerciseSetType.Cluster,
]);

/** The badge's tint, by type. Plain sets have none. */
export const BadgeTones = {
  Plain: 'plain',
  Warmup: 'warmup',
  Drop: 'drop',
  Failure: 'failure',
  Amrap: 'amrap',
  Other: 'other',
} as const;
export type BadgeTone = (typeof BadgeTones)[keyof typeof BadgeTones];

const TONE_BY_TYPE: Partial<Record<ExerciseSetType, BadgeTone>> = {
  [ExerciseSetType.Warmup]: BadgeTones.Warmup,
  [ExerciseSetType.Dropset]: BadgeTones.Drop,
  [ExerciseSetType.Failure]: BadgeTones.Failure,
  [ExerciseSetType.Amrap]: BadgeTones.Amrap,
  [ExerciseSetType.RestPause]: BadgeTones.Other,
  [ExerciseSetType.Cluster]: BadgeTones.Other,
};

export interface SetBadge {
  /** "W", "D", or the set's number counted without warm-ups. */
  text: string;
  tone: BadgeTone;
  /** "Set 2", "Warm-up": what the focus card calls the set. */
  name: string;
  /**
   * What labels elsewhere (the pad, the rest bar, "Back to…") call it after
   * the exercise's name, when that differs from `name`: "Round 2" in a superset.
   */
  short?: string;
}

/**
 * The set's badge. Warm-ups don't count toward the numbering (W, 1, 2, 3),
 * and a typed set wears its letter where the number would be.
 */
export function setBadge(
  sets: readonly LoggedSet[],
  index: number,
  /** In a superset: the member's tag ("A1") and the exercise's name. */
  member: { tag: string; name: string } | null = null,
): SetBadge {
  const set = sets[index];
  const type = set?.setType;
  if (type && LETTER_TYPES.has(type)) {
    const typeName = enumLabel('exerciseSetType', type);
    return {
      text: translate(`workouts.setBadge.${type}`),
      tone: TONE_BY_TYPE[type] ?? BadgeTones.Other,
      name: member ? `${member.tag} · ${typeName}` : typeName,
      ...(member ? { short: typeName } : {}),
    };
  }
  if (member) {
    // The badge carries the tag; the card names the exercise; labels say the round.
    return {
      text: member.tag,
      tone: BadgeTones.Plain,
      name: member.name,
      short: translate('workouts.superset.round', { number: index + 1 }),
    };
  }
  const warmupsBefore = sets
    .slice(0, index)
    .filter((s) => s.setType === ExerciseSetType.Warmup).length;
  const number = index + 1 - warmupsBefore;
  return {
    text: String(number),
    tone: BadgeTones.Plain,
    name: translate('workouts.logger.setNumber', { number }),
  };
}

/** Which log column each set field writes to. */
export const PAYLOAD_KEY: Record<
  SetField,
  'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters'
> = {
  [SetFields.Weight]: 'weightKg',
  [SetFields.Reps]: 'reps',
  [SetFields.Duration]: 'durationSeconds',
  [SetFields.Distance]: 'distanceMeters',
};

export function cellValue(set: LoggedSet | null | undefined, field: SetField): number | null {
  return set?.[PAYLOAD_KEY[field]] ?? null;
}

/**
 * What a set is pre-filled with, shown in grey until it is confirmed or typed
 * over: the plan's target, else what the same set held last time, else what
 * the set before it in this session holds. A rep range pre-fills last time's
 * reps when they fall inside it, otherwise its bottom: the floor you aim at.
 */
export function prefillValue(
  set: LoggedSet,
  field: SetField,
  previous: LoggedSet | null,
  sessionBefore: LoggedSet | null,
): number | null {
  const plan = planOf(set);
  switch (field) {
    case SetFields.Weight:
      return (
        plan?.resolvedWeightKg ??
        plan?.targetWeightKg ??
        previous?.weightKg ??
        sessionBefore?.weightKg ??
        null
      );
    case SetFields.Reps: {
      const min = plan?.targetRepsMin ?? null;
      const max = plan?.targetRepsMax ?? null;
      if (min != null && max != null && min !== max) {
        const last = previous?.reps ?? null;
        return last != null && last >= min && last <= max ? last : min;
      }
      return min ?? max ?? previous?.reps ?? sessionBefore?.reps ?? null;
    }
    case SetFields.Duration:
      return (
        plan?.targetDurationSeconds ??
        previous?.durationSeconds ??
        sessionBefore?.durationSeconds ??
        null
      );
    case SetFields.Distance:
      return (
        plan?.targetDistanceMeters ??
        previous?.distanceMeters ??
        sessionBefore?.distanceMeters ??
        null
      );
  }
}

/** The cells a set row draws, in order: by kind, plus weight when the person loads a bodyweight move. */
export function fieldsFor(kind: string | null | undefined, addedWeight: boolean): SetField[] {
  const base = setFieldsFor(kind);
  return addedWeight && !base.includes(SetFields.Weight) ? [SetFields.Weight, ...base] : base;
}

/** One value as a row reads it: "62.5 kg", "8", "1:30", "400 m". */
export function fieldText(field: SetField, value: number, withUnit: boolean): string {
  switch (field) {
    case SetFields.Weight:
      return withUnit
        ? translate('workouts.units.kg', { value: formatMeasure(value) })
        : formatMeasure(value);
    case SetFields.Reps:
      return formatMeasure(value);
    case SetFields.Duration:
      return secondsToClock(value);
    case SetFields.Distance:
      return withUnit
        ? translate('workouts.units.meters', { value: formatMeasure(value) })
        : formatMeasure(value);
  }
}

/**
 * A set in one line: "62.5 kg × 8", "× 15", "1:30", "400 m · 1:45". Values
 * that are missing fall back to `fallback` (the pre-fill), and the line is
 * empty when there is nothing at all.
 */
export function setLine(
  fields: readonly SetField[],
  valueOf: (field: SetField) => number | null,
  withUnit: boolean,
): string {
  const values = fields
    .map((field) => ({ field, value: valueOf(field) }))
    .filter((v): v is { field: SetField; value: number } => v.value != null);
  if (!values.length) return '';
  const hasWeight = values.some((v) => v.field === SetFields.Weight);
  const reps = values.find((v) => v.field === SetFields.Reps);
  if (reps && !hasWeight) {
    // Reps alone read as a count, the way the design writes push-ups: "× 15".
    return `× ${formatMeasure(reps.value)}`;
  }
  const joiner = reps ? ' × ' : ' · ';
  return values.map((v) => fieldText(v.field, v.value, withUnit)).join(joiner);
}

/** "last 60 × 8": the same set last time, short. Empty when there was none. */
export function lastLine(fields: readonly SetField[], previous: LoggedSet | null): string {
  if (!previous) return '';
  const line = setLine(fields, (field) => cellValue(previous, field), false);
  return line ? translate('workouts.logger.last', { value: line }) : '';
}

/** What a rest can be bent by during a workout, from the change-rest sheet. */
export interface RestChoices {
  /** The next set is the next exercise of the same superset round: no rest. */
  sameRound?: boolean;
  /** "This exercise": wins over the plan for the exercise just worked. */
  exerciseOverride?: number | null;
  /** "Every exercise in this workout": where no other rest is set. */
  workoutDefault?: number | null;
  /** The person's own default, else 90 s. */
  personDefault?: number;
}

/**
 * How long to rest after ticking `done`, or null for no rest. First match wins:
 * - nothing left to do, the next set is in the same superset round, or it
 *   is a drop set: no rest;
 * - a warm-up rests its own planned time, else 45 s;
 * - this exercise's rest set during the workout;
 * - the plan's rest (the set's, the day's, the program's);
 * - every exercise's rest set during the workout;
 * - the person's default, else 90 s.
 */
export function restAfterTick(
  done: LoggedSet,
  next: LoggedSet | null,
  choices: RestChoices = {},
): number | null {
  if (!next) return null;
  if (choices.sameRound) return null;
  if (next.setType === ExerciseSetType.Dropset) return null;
  const planned = done.plannedRestSeconds ?? planOf(done)?.restAfterSeconds ?? null;
  if (done.setType === ExerciseSetType.Warmup) return planned ?? WARMUP_REST_SECONDS;
  return (
    choices.exerciseOverride ??
    planned ??
    choices.workoutDefault ??
    choices.personDefault ??
    DEFAULT_REST_SECONDS
  );
}

/** A rest under this is not worth storing: it was a fumble, not a rest. */
export const MIN_STORED_REST_SECONDS = 5;
/** A gap over this (or over three planned rests) is a break, not a rest. */
export const BREAK_AFTER_SECONDS = 600;

/**
 * How long a set takes, to take off the gap between two ticks: the logged
 * time for a timed set, else about 3 s a rep, between 20 s and 90 s.
 */
export function setLengthSeconds(set: LoggedSet): number {
  if (set.durationSeconds != null) return set.durationSeconds;
  const reps = set.reps ?? 8;
  return Math.min(90, Math.max(20, reps * 3));
}

/** The rest to store on a set, and how it was measured. */
export interface MeasuredRest {
  seconds: number | null;
  source: RestSource;
}

/**
 * The rest after a set, measured at the next tick when nobody ended it by
 * hand: the gap between the ticks minus the next set's own length. A gap
 * over ten minutes (or three planned rests) is a break and stores no time;
 * an estimate under 5 s stores nothing at all (null).
 */
export function estimatedRest(
  gapSeconds: number,
  plannedSeconds: number,
  nextSet: LoggedSet,
): MeasuredRest | null {
  if (gapSeconds > Math.max(BREAK_AFTER_SECONDS, 3 * plannedSeconds)) {
    return { seconds: null, source: RestSources.Break };
  }
  const seconds = Math.round(gapSeconds - setLengthSeconds(nextSet));
  return seconds < MIN_STORED_REST_SECONDS ? null : { seconds, source: RestSources.Estimated };
}

/** The rest someone ended themselves (Start set, Skip): exact. */
export function tappedRest(gapSeconds: number): MeasuredRest {
  return { seconds: Math.max(0, Math.round(gapSeconds)), source: RestSources.Tap };
}

/** The plan's target effort for a set, as RPE (reps in reserve converted). */
export function effortTarget(set: LoggedSet): number | null {
  const plan = planOf(set);
  if (plan?.targetRpe != null) return Number(plan.targetRpe);
  if (plan?.targetRir != null) return Math.max(1, 10 - plan.targetRir);
  return null;
}

/**
 * Whether to ask how hard a set was, right after its tick: off by default,
 * on when the person turned it on, and on by itself where the plan sets a
 * target effort. Never for a warm-up.
 */
export function asksEffort(set: LoggedSet, askAlways: boolean): boolean {
  if (set.setType === ExerciseSetType.Warmup) return false;
  return askAlways || effortTarget(set) != null;
}

/**
 * "4 sets · best 65 × 8" for a finished exercise folded to one line. Best is
 * the heaviest weight × reps among the working sets; without weight, the
 * most reps, the longest hold or the furthest distance.
 */
export function foldedSummary(exercise: LoggedExercise, kind: ExerciseKind | null): string {
  const done = (exercise.sets ?? []).filter((set) => set.isCompleted);
  const parts = [translate('count.sets', { count: done.length })];
  const working = done.filter((set) => set.setType !== ExerciseSetType.Warmup);
  const fields = setFieldsFor(kind);
  const score = (set: LoggedSet): number =>
    set.weightKg != null && set.reps != null
      ? set.weightKg * set.reps
      : (set.reps ?? set.durationSeconds ?? set.distanceMeters ?? 0);
  const best = working.reduce<LoggedSet | null>(
    (top, set) => (score(set) > (top ? score(top) : 0) ? set : top),
    null,
  );
  if (best) {
    const line = setLine(
      best.weightKg != null && !fields.includes(SetFields.Weight)
        ? [SetFields.Weight, ...fields]
        : fields,
      (field) => cellValue(best, field),
      false,
    );
    if (line) parts.push(translate('workouts.logger.best', { value: line }));
  }
  return parts.join(' · ');
}

/**
 * The plan's line under an exercise's name: "3 × 8–10 · effort 8 · 62.5 kg ·
 * rest 2:00", read from the working sets' targets. Empty without a plan.
 */
export function planLine(exercise: LoggedExercise): string {
  const planned = (exercise.sets ?? [])
    .filter((set) => set.setType !== ExerciseSetType.Warmup)
    .map((set) => ({ set, plan: planOf(set) }))
    .filter((p): p is { set: LoggedSet; plan: PlanSet } => p.plan !== null);
  if (!planned.length) return '';
  const first = planned[0].plan;
  const parts: string[] = [];

  const min = first.targetRepsMin;
  const max = first.targetRepsMax;
  if (min != null || max != null) {
    const reps =
      min != null && max != null && min !== max
        ? translate('workouts.prescription.compactRange', { min, max })
        : String(min ?? max);
    parts.push(translate('workouts.prescription.compact', { sets: planned.length, reps }));
  } else if (first.targetDurationSeconds != null) {
    parts.push(
      translate('workouts.prescription.compactHold', {
        sets: planned.length,
        seconds: first.targetDurationSeconds,
      }),
    );
  }

  const effort = effortTarget(planned[0].set);
  if (effort != null) {
    parts.push(translate('workouts.logger.plan.effort', { value: formatMeasure(effort) }));
  }
  const kg = first.resolvedWeightKg ?? first.targetWeightKg;
  if (kg != null) parts.push(translate('workouts.units.kg', { value: formatMeasure(kg) }));
  const rest = planned[0].set.plannedRestSeconds ?? first.restAfterSeconds;
  if (rest != null && rest > 0) {
    parts.push(translate('workouts.logger.plan.rest', { value: secondsToClock(rest) }));
  }
  return parts.join(' · ');
}
