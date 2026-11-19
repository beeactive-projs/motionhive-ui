import {
  CreateRoutineExercisePayload,
  CreateRoutineSetPayload,
  ExerciseSetType,
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineExercise,
  RoutineSet,
  RoutineSources,
  WorkoutLog,
  appLocale,
  decimalToNumber,
  normalizeSupersets,
  translate,
} from 'core';

import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { DEFAULT_SETS } from '../workouts.config';

/**
 * A workout started from your own routine, compared with that routine at
 * Finish: what changed in its shape, how to say so, and the routine it
 * would become (user decisions, 2026-11-16: asked in a sheet at Finish; the
 * new shape keeps the routine's targets, and what is new takes what was
 * logged).
 *
 * Only the shape counts as a change: exercises added, removed, swapped or
 * moved, a different number of sets, other supersets. Lifting more is what
 * a workout is for, and skipping an exercise is a decision about today, so
 * neither asks.
 */

/** What changed between a routine and a workout done from it. Names are the exercises'. */
export interface RoutineChanges {
  added: string[];
  removed: string[];
  /** The movements put in for one of the routine's. */
  swapped: string[];
  /** Exercises done with a different number of sets. */
  sets: string[];
  reordered: boolean;
  supersets: boolean;
}

/** The two answers to "Update the routine?". Closing the sheet is a third: back to the workout. */
export const RoutineUpdateChoices = {
  Update: 'update',
  Keep: 'keep',
} as const;

export type RoutineUpdateChoice =
  (typeof RoutineUpdateChoices)[keyof typeof RoutineUpdateChoices];

/**
 * Both answers finish the workout. Updating edits the routine (honey); keeping
 * it is finishing as it is, done (green, its shade: the base emerald is under
 * 3:1 for the white glyph).
 */
export const ROUTINE_UPDATE_ACTIONS: readonly SheetAction<RoutineUpdateChoice>[] = [
  {
    id: RoutineUpdateChoices.Update,
    label: 'workouts.updateRoutine.update',
    hint: 'workouts.updateRoutine.updateHint',
    icon: 'refresh-outline',
    color: 'primary',
  },
  {
    id: RoutineUpdateChoices.Keep,
    label: 'workouts.updateRoutine.keep',
    hint: 'workouts.updateRoutine.keepHint',
    icon: 'flag-outline',
    color: 'success',
    tone: 'shade',
  },
];

/**
 * The routine a workout can update: one of yours, started as a routine. A
 * coach's plan day, a multi-week program and a freestyle workout have none.
 */
export function updatableRoutineId(log: WorkoutLog): string | null {
  if (log.assignedWorkoutId || !log.sourceProgramId) return null;
  return log.sourceProgram?.isSingleWorkout === true ? log.sourceProgramId : null;
}

/** Yours to change: a starter belongs to nobody, and a routine shared with you to its owner. */
export function isOwnRoutine(routine: Routine, userId: string | null | undefined): boolean {
  return !!userId && routine.ownerId === userId && routine.source !== RoutineSources.System;
}

/** One exercise of the workout, and the routine's exercise it was done for (null when added). */
interface Match {
  logged: LoggedExercise;
  planned: RoutineExercise | null;
}

/**
 * Pairs the workout's exercises with the routine's, by the link the start
 * wrote (`prescribedExercise`). A swap that came back without the link
 * still names what it replaced, so it pairs with that. Last, any other
 * exercise left unpaired takes the routine's first unclaimed one of the
 * same movement: saving the routine mid-workout rewrites its exercises, and
 * the database then clears every link the running workout held.
 */
function matchExercises(routine: Routine, exercises: readonly LoggedExercise[]): Match[] {
  const planned = [...(routine.exercises ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const byId = new Map(planned.map((p) => [p.id, p]));
  const used = new Set<string>();
  const claim = (exerciseId: string | null): RoutineExercise | null => {
    const match = exerciseId
      ? (planned.find((p) => !used.has(p.id) && p.exerciseId === exerciseId) ?? null)
      : null;
    if (match) used.add(match.id);
    return match;
  };
  const linked = exercises.map((logged): Match => {
    const id = logged.prescribedExercise?.id ?? null;
    const match = id ? (byId.get(id) ?? null) : null;
    if (match) used.add(match.id);
    return { logged, planned: match };
  });
  const swaps = linked.map((m) =>
    m.planned || !m.logged.swappedFromExerciseId
      ? m
      : { ...m, planned: claim(m.logged.swappedFromExerciseId) },
  );
  return swaps.map((m) =>
    m.planned || m.logged.swappedFromExerciseId ? m : { ...m, planned: claim(m.logged.exerciseId) },
  );
}

function plannedSetCount(planned: RoutineExercise): number {
  return planned.sets?.length || planned.defaultSets || DEFAULT_SETS;
}

function plannedName(planned: RoutineExercise): string {
  return planned.exercise?.name ?? translate('workouts.common.exercise');
}

/** "a+b": each pair of neighbours linked as a superset, by a key both sides share. */
function supersetPairs<T>(
  rows: readonly T[],
  group: (row: T) => number | null,
  key: (row: T) => string | null,
): Set<string> {
  const pairs = new Set<string>();
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    const a = key(row);
    const b = next ? key(next) : null;
    const g = group(row);
    if (next && g !== null && g === group(next) && a && b) pairs.add(`${a}+${b}`);
  });
  return pairs;
}

/** What changed in the routine's shape, or null when nothing did. */
export function routineChanges(
  routine: Routine,
  exercises: readonly LoggedExercise[],
): RoutineChanges | null {
  const planned = [...(routine.exercises ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const matches = matchExercises(routine, exercises);
  const linked = new Set(matches.flatMap((m) => (m.planned ? [m.planned.id] : [])));

  const added = matches
    .filter((m) => !m.planned && !m.logged.isSkipped && m.logged.exerciseId)
    .map((m) => m.logged.exerciseNameSnapshot);
  const removed = planned.filter((p) => !linked.has(p.id)).map(plannedName);
  const live = matches.filter(
    (m): m is { logged: LoggedExercise; planned: RoutineExercise } =>
      !!m.planned && !m.logged.isSkipped,
  );
  const swapped = live
    .filter((m) => m.logged.exerciseId !== m.planned.exerciseId)
    .map((m) => m.logged.exerciseNameSnapshot);
  const sets = live
    .filter(
      (m) =>
        m.logged.exerciseId === m.planned.exerciseId &&
        (m.logged.sets ?? []).length !== plannedSetCount(m.planned),
    )
    .map((m) => m.logged.exerciseNameSnapshot);

  const order = matches.flatMap((m) => (m.planned ? [m.planned.id] : []));
  const expected = planned.filter((p) => linked.has(p.id)).map((p) => p.id);
  const reordered = order.join() !== expected.join();

  // Only between exercises both sides have: one removed or added is said already.
  const workoutPairs = supersetPairs(
    matches,
    (m) => m.logged.supersetGroupId ?? null,
    (m) => m.planned?.id ?? null,
  );
  const routinePairs = supersetPairs(
    planned.filter((p) => linked.has(p.id)),
    (p) => p.supersetGroupId,
    (p) => p.id,
  );
  const supersets =
    workoutPairs.size !== routinePairs.size ||
    [...workoutPairs].some((pair) => !routinePairs.has(pair));

  const changes = { added, removed, swapped, sets, reordered, supersets };
  const any =
    added.length || removed.length || swapped.length || sets.length || reordered || supersets;
  return any ? changes : null;
}

/** Up to three names, then "2 more", joined as the reader's language joins a list. */
function nameList(names: readonly string[]): string {
  const shown =
    names.length > 3
      ? [
          ...names.slice(0, 2),
          translate('workouts.updateRoutine.more', { count: names.length - 2 }),
        ]
      : [...names];
  return new Intl.ListFormat(appLocale(), { type: 'conjunction' }).format(shown);
}

/** "You added Lunges. You changed the sets of Bench press.": one sentence per kind of change. */
export function changeSummary(changes: RoutineChanges): string {
  const sentences: string[] = [];
  if (changes.added.length) {
    sentences.push(translate('workouts.updateRoutine.added', { names: nameList(changes.added) }));
  }
  if (changes.removed.length) {
    sentences.push(
      translate('workouts.updateRoutine.removed', { names: nameList(changes.removed) }),
    );
  }
  if (changes.swapped.length) {
    sentences.push(
      translate('workouts.updateRoutine.swapped', { names: nameList(changes.swapped) }),
    );
  }
  if (changes.sets.length) {
    sentences.push(translate('workouts.updateRoutine.sets', { names: nameList(changes.sets) }));
  }
  if (changes.reordered) sentences.push(translate('workouts.updateRoutine.reordered'));
  if (changes.supersets) sentences.push(translate('workouts.updateRoutine.supersets'));
  return sentences.join(' ');
}

/** Only what is set: the API reads a missing target as none. */
function setPayload(values: {
  setType: string;
  repsMin: number | null;
  repsMax: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  restAfterSeconds: number | null;
}): CreateRoutineSetPayload {
  return {
    setType: values.setType,
    ...(values.repsMin !== null ? { targetRepsMin: values.repsMin } : {}),
    ...(values.repsMax !== null ? { targetRepsMax: values.repsMax } : {}),
    ...(values.weightKg !== null ? { targetWeightKg: values.weightKg } : {}),
    ...(values.durationSeconds !== null ? { targetDurationSeconds: values.durationSeconds } : {}),
    ...(values.distanceMeters !== null ? { targetDistanceMeters: values.distanceMeters } : {}),
    ...(values.restAfterSeconds !== null ? { restAfterSeconds: values.restAfterSeconds } : {}),
  };
}

/** A set the routine planned: its targets as planned, its type as done. */
function keptSet(set: LoggedSet): CreateRoutineSetPayload {
  const plan = set.prescribedSet!;
  return setPayload({
    setType: set.setType,
    repsMin: plan.targetRepsMin ?? null,
    repsMax: plan.targetRepsMax ?? null,
    weightKg: decimalToNumber(plan.targetWeightKg),
    durationSeconds: plan.targetDurationSeconds ?? null,
    distanceMeters: plan.targetDistanceMeters ?? null,
    restAfterSeconds: plan.restAfterSeconds ?? null,
  });
}

/** A set the workout added: what was logged becomes its target, resting as its exercise does. */
function loggedSet(set: LoggedSet, rest: number | null): CreateRoutineSetPayload {
  const reps = decimalToNumber(set.reps);
  return setPayload({
    setType: set.setType,
    repsMin: reps,
    repsMax: reps,
    weightKg: decimalToNumber(set.weightKg),
    durationSeconds: decimalToNumber(set.durationSeconds),
    distanceMeters: decimalToNumber(set.distanceMeters),
    restAfterSeconds: rest,
  });
}

/** One of the routine's own sets, as the routine has it, of the type given. */
function routineSet(set: RoutineSet, setType: string): CreateRoutineSetPayload {
  return setPayload({
    setType,
    repsMin: set.targetRepsMin,
    repsMax: set.targetRepsMax,
    weightKg: set.targetWeightKg,
    durationSeconds: set.targetDurationSeconds,
    distanceMeters: set.targetDistanceMeters,
    restAfterSeconds: set.restAfterSeconds,
  });
}

/** The routine's exercise as it stands: a skipped one stays in the routine untouched. */
function plannedExercise(planned: RoutineExercise): {
  row: CreateRoutineExercisePayload;
  group: number | null;
} {
  const sets = (planned.sets ?? []).map((set) => routineSet(set, set.setType));
  return {
    row: {
      exerciseId: planned.exerciseId,
      ...(sets.length ? { sets } : { defaultSets: planned.defaultSets || DEFAULT_SETS }),
      ...(planned.notes ? { notes: planned.notes } : {}),
    },
    group: planned.supersetGroupId,
  };
}

/** The rest the routine's exercise plans after its working sets, for a set added beside them. */
function plannedRest(planned: RoutineExercise | null): number | null {
  const working = planned?.sets?.find((set) => set.setType !== ExerciseSetType.Warmup);
  return working?.restAfterSeconds ?? planned?.restAfterSeconds ?? null;
}

/**
 * The routine as the workout left it, for `RoutineService.update`: the
 * workout's exercises in the workout's order, with its sets and supersets.
 * A set the routine planned keeps the routine's targets; a set or an
 * exercise the workout added takes what was logged. A swapped-in movement
 * is new, so it takes what was logged too: the old one's numbers mean
 * nothing for it. A skipped exercise stays as the routine had it, and one
 * taken out of the workout leaves the routine. The routine's notes on an
 * exercise stay with it. An exercise whose links were cleared (the routine
 * was saved mid-workout) keeps the routine's sets by position.
 */
export function routineFromWorkout(
  routine: Routine,
  exercises: readonly LoggedExercise[],
): CreateRoutineExercisePayload[] {
  const rows = matchExercises(routine, exercises).flatMap(({ logged, planned }) => {
    if (logged.isSkipped) return planned ? [plannedExercise(planned)] : [];
    // A movement since deleted from the catalog cannot be planned again.
    if (!logged.exerciseId) return [];
    const same = !!planned && planned.exerciseId === logged.exerciseId;
    const rest = same ? plannedRest(planned) : null;
    // Paired by movement (its links were cleared): the routine's sets by position.
    const byPosition = same && !logged.prescribedExercise ? (planned.sets ?? []) : [];
    const sets = (logged.sets ?? []).map((set, i) => {
      if (same && set.prescribedSet) return keptSet(set);
      const plan = byPosition[i];
      return plan ? routineSet(plan, set.setType) : loggedSet(set, rest);
    });
    return [
      {
        row: {
          exerciseId: logged.exerciseId,
          ...(sets.length ? { sets } : { defaultSets: 1 }),
          ...(planned?.notes ? { notes: planned.notes } : {}),
        } satisfies CreateRoutineExercisePayload,
        group: logged.supersetGroupId ?? null,
      },
    ];
  });

  return normalizeSupersets(rows.map((r) => ({ ...r, supersetGroupId: r.group }))).map(
    ({ row, supersetGroupId }) =>
      supersetGroupId !== null ? { ...row, supersetGroupId } : row,
  );
}
