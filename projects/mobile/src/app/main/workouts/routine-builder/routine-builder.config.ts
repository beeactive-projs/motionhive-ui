import {
  CreateRoutineExercisePayload,
  CreateRoutineSetPayload,
  Exercise,
  ExerciseKind,
  ExerciseSetType,
  RoutineExercise,
  RoutineSet,
  SetField,
  SetFields,
  linkWithNext,
  normalizeSupersets,
  translate,
  unlinkFromNext,
} from 'core';

import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { ChoiceOption } from '../../../_shared/components/choice-sheet/choice-sheet';
import { PAYLOAD_KEY, SetValues, cellValue, fieldsFor } from '../logger/logger-flow';
import { DEFAULT_SETS, secondsToClock } from '../workouts.config';

export { linkWithNext, normalizeSupersets, supersetTags, unlinkFromNext } from 'core';
export type { Linkable } from 'core';

/** Rests offered in the builder, one tap each. */
export const BUILDER_REST_CHOICES = [45, 60, 90, 120, 150, 180, 240, 300] as const;

/** The value a rest sheet uses for "no rest of its own". */
export const NO_REST = '';

/**
 * Which rest the rest sheet sets when it is the routine's, "Rest between
 * sets", as against one exercise's (the sheet is then keyed by its row).
 */
export const ROUTINE_REST = 'routine';

/**
 * Rows for a rest sheet: what applies when this one sets nothing (the
 * person's default, or the routine's), then the rests themselves.
 */
export function builderRestChoices(inherit: string): ChoiceOption[] {
  return [
    { value: NO_REST, label: inherit },
    ...BUILDER_REST_CHOICES.map((seconds) => ({
      value: String(seconds),
      label: secondsToClock(seconds),
    })),
  ];
}

/** "Your default (1:30)": what the routine rests when it sets nothing itself. */
export function personDefaultLabel(seconds: number): string {
  return translate('workouts.routineBuilder.rest.yourDefault', { value: secondsToClock(seconds) });
}

// ─── The draft ────────────────────────────────────────────────────────────

/**
 * One set being planned: its type and its targets, keyed as a logged set's
 * values (`reps`, `weightKg`, …) so the logger's set row draws it as it is.
 */
export interface DraftSet extends SetValues {
  /** Stable across edits, for `track`. */
  key: string;
  setType: ExerciseSetType;
  /** The top of a rep range ("8–12"), when the set has one; `reps` is its bottom. */
  repsMax: number | null;
  restAfterSeconds: number | null;
}

/** One exercise being planned, with its sets. */
export interface DraftExercise {
  /** Stable across edits, for `track`. */
  key: string;
  exerciseId: string;
  name: string;
  kind: ExerciseKind | null;
  thumbnailUrl: string | null;
  /** Split squats and one-arm work: reps read as per side. */
  unilateral: boolean;
  /** The routine's note on the exercise. Kept as it is, so a save never drops it. */
  notes: string | null;
  /** Rows sharing a number stand together as a superset. */
  supersetGroupId: number | null;
  /** A bodyweight move the person loads: weight joins its fields. */
  addedWeight: boolean;
  /**
   * Planned set by set, in the set table, rather than with one stepper per
   * field for all its sets. On by itself for an exercise whose sets differ
   * (a pyramid, a warm-up), so the steppers never flatten them unasked.
   */
  perSet: boolean;
  sets: DraftSet[];
}

/** Makes the next stable key. */
export type KeyMaker = () => string;

/** A set with nothing planned yet. */
export function emptySet(key: string): DraftSet {
  return {
    key,
    setType: ExerciseSetType.Normal,
    reps: null,
    repsMax: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    restAfterSeconds: null,
  };
}

/** A freshly picked movement: three empty sets, as the logger adds it. */
export function draftFromPick(exercise: Exercise, nextKey: KeyMaker): DraftExercise {
  return {
    key: nextKey(),
    exerciseId: exercise.id,
    name: exercise.name,
    kind: exercise.kind ?? null,
    thumbnailUrl: exercise.thumbnailUrl ?? null,
    unilateral: exercise.isUnilateral ?? false,
    notes: null,
    supersetGroupId: null,
    addedWeight: false,
    perSet: false,
    sets: Array.from({ length: DEFAULT_SETS }, () => emptySet(nextKey())),
  };
}

function draftSetFrom(set: RoutineSet, key: string): DraftSet {
  const min = set.targetRepsMin ?? null;
  const max = set.targetRepsMax ?? null;
  return {
    key,
    setType: (set.setType as ExerciseSetType) || ExerciseSetType.Normal,
    reps: min ?? max,
    repsMax: min !== null && max !== null && max !== min ? max : null,
    weightKg: set.targetWeightKg ?? null,
    durationSeconds: set.targetDurationSeconds ?? null,
    distanceMeters: set.targetDistanceMeters ?? null,
    restAfterSeconds: set.restAfterSeconds ?? null,
  };
}

/**
 * A saved exercise as the builder edits it: every set it holds, as it holds
 * them. An exercise saved with only the flat summary (an older routine)
 * stands in for its rows with that many identical sets.
 */
export function draftFromRoutine(
  exercise: RoutineExercise,
  fallbackName: string,
  nextKey: KeyMaker,
): DraftExercise {
  const flat: RoutineSet = {
    setType: ExerciseSetType.Normal,
    targetRepsMin: exercise.targetRepsMin,
    targetRepsMax: exercise.targetRepsMax,
    targetWeightKg: exercise.targetWeightKg,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    restAfterSeconds: exercise.restAfterSeconds,
  };
  const saved = exercise.sets?.length
    ? exercise.sets
    : Array.from({ length: exercise.defaultSets || DEFAULT_SETS }, () => flat);
  const sets = saved.map((set) => draftSetFrom(set, nextKey()));
  const kind = (exercise.exercise?.kind as ExerciseKind | undefined) ?? null;
  return {
    key: nextKey(),
    exerciseId: exercise.exerciseId,
    name: exercise.exercise?.name ?? fallbackName,
    kind,
    thumbnailUrl: exercise.exercise?.thumbnailUrl ?? null,
    unilateral: false,
    notes: exercise.notes ?? null,
    supersetGroupId: exercise.supersetGroupId ?? null,
    addedWeight: kind === ExerciseKind.Bodyweight && sets.some((set) => set.weightKg !== null),
    perSet: !isUniform(sets),
    sets,
  };
}

/** Set types that are plain sets as far as one stepper for all of them goes. */
const PLAIN_TYPES = new Set<string>([ExerciseSetType.Normal, ExerciseSetType.Working]);

/**
 * Every set the same: plain, with the same targets. Then one stepper per
 * field says it all. Rest is left out: it has its chip.
 */
export function isUniform(sets: readonly DraftSet[]): boolean {
  const [first] = sets;
  return sets.every(
    (set) =>
      PLAIN_TYPES.has(set.setType) &&
      set.reps === first.reps &&
      set.repsMax === first.repsMax &&
      set.weightKg === first.weightKg &&
      set.durationSeconds === first.durationSeconds &&
      set.distanceMeters === first.distanceMeters,
  );
}

/**
 * The fields the steppers show, after Sets: as the set table orders them,
 * except weight, which goes last ("Sets · Reps · Weight (kg)").
 */
export function stepperFields(row: DraftExercise): SetField[] {
  const fields = draftFields(row);
  return [
    ...fields.filter((field) => field !== SetFields.Weight),
    ...fields.filter((field) => field === SetFields.Weight),
  ];
}

/** Every set with `field` at `value`. */
export function withAll(row: DraftExercise, field: SetField, value: number | null): DraftExercise {
  return { ...row, sets: row.sets.map((set) => withValue(set, field, value)) };
}

/**
 * One ± on a field's stepper, for every set: by the pad's own step (2.5 kg,
 * 1 rep, 15 s, 50 m), from nothing up to one step. Stepping down to nothing
 * clears the target. A rep range moves as a whole: 8–12 up one is 9–13.
 */
export function steppedAll(
  row: DraftExercise,
  field: SetField,
  delta: 1 | -1,
  step: number,
): DraftExercise {
  const first = row.sets[0];
  if (!first) return row;
  const move = (value: number | null): number | null => {
    const next = Math.round(((value ?? 0) + delta * step) * 100) / 100;
    return next > 0 ? next : null;
  };
  if (field === SetFields.Reps && first.reps !== null && first.repsMax !== null) {
    const reps = move(first.reps);
    const repsMax = reps === null ? null : move(first.repsMax);
    return { ...row, sets: row.sets.map((set) => ({ ...set, reps, repsMax })) };
  }
  return withAll(row, field, move(cellValue(first, field)));
}

/**
 * Back to one stepper per field: every set takes the first working set's
 * targets as a plain set, keeping its own rest. A row whose sets were all
 * swiped away gets one empty set (`key`), as Sets never goes below one: the
 * steppers would otherwise show 0 sets and step nothing.
 */
export function flattened(row: DraftExercise, key: string): DraftExercise {
  const model = row.sets.find((set) => set.setType !== ExerciseSetType.Warmup) ?? row.sets[0];
  if (!model) return { ...row, perSet: false, sets: [emptySet(key)] };
  return {
    ...row,
    perSet: false,
    sets: row.sets.map((set) => ({
      ...set,
      setType: ExerciseSetType.Normal,
      reps: model.reps,
      repsMax: model.repsMax,
      weightKg: model.weightKg,
      durationSeconds: model.durationSeconds,
      distanceMeters: model.distanceMeters,
    })),
  };
}

/**
 * The targets an exercise is planned by, in order: by its kind, with weight
 * on a timed hold too (a weighted plank, a loaded carry: Sets · Time ·
 * Weight, user decision, 2026-11-16) and on a bodyweight move once added.
 *
 * Plus any time or distance its sets already hold, whatever the kind says:
 * the catalogue files Plank under strength, so its 45 s hold was saved and
 * shown on the read view but drawn nowhere in the builder, and could not be
 * changed.
 */
export function draftFields(
  row: Pick<DraftExercise, 'kind' | 'addedWeight' | 'sets'>,
): SetField[] {
  const fields = fieldsFor(row.kind, row.addedWeight || row.kind === ExerciseKind.Duration);
  const held = (key: 'durationSeconds' | 'distanceMeters') =>
    row.sets.some((set) => set[key] !== null);
  return [
    ...fields,
    ...(held('durationSeconds') && !fields.includes(SetFields.Duration)
      ? [SetFields.Duration]
      : []),
    ...(held('distanceMeters') && !fields.includes(SetFields.Distance)
      ? [SetFields.Distance]
      : []),
  ];
}

/** "8–12" for a rep range, or nothing when the set aims at one number. */
export function repsRangeText(set: DraftSet): string | null {
  if (set.reps === null || set.repsMax === null || set.repsMax === set.reps) return null;
  return translate('workouts.prescription.compactRange', { min: set.reps, max: set.repsMax });
}

/** The set with `field` set to `value`. A typed rep count replaces a range. */
export function withValue(set: DraftSet, field: SetField, value: number | null): DraftSet {
  return field === SetFields.Reps
    ? { ...set, reps: value, repsMax: null }
    : { ...set, [PAYLOAD_KEY[field]]: value };
}

/** Another set like this one: its type and targets, under a new key. */
export function copyOfSet(set: DraftSet, key: string): DraftSet {
  return { ...set, key };
}

/**
 * What Add set adds: the numbers of the set before it, so a 4 × 8 at 60 kg
 * takes one tap to become 5 × 8, as a plain set. A warm-up or a drop set
 * is the odd one out, not the pattern to repeat.
 */
export function nextSet(row: Pick<DraftExercise, 'sets'>, key: string): DraftSet {
  const last = row.sets[row.sets.length - 1];
  return last ? { ...last, key, setType: ExerciseSetType.Normal } : emptySet(key);
}

/**
 * The exercise with its targets kept only for `kind`'s fields: a swap keeps
 * no stale plank time on a squat.
 */
export function swapped(row: DraftExercise, exercise: Exercise, key: string): DraftExercise {
  const next: DraftExercise = {
    ...row,
    key,
    exerciseId: exercise.id,
    name: exercise.name,
    kind: exercise.kind ?? null,
    thumbnailUrl: exercise.thumbnailUrl ?? null,
    unilateral: exercise.isUnilateral ?? false,
    addedWeight: false,
  };
  // By the new kind alone: the old sets' plank time must not keep itself.
  const keep = new Set(draftFields({ ...next, sets: [] }));
  return {
    ...next,
    sets: row.sets.map((set) => ({
      ...set,
      reps: keep.has(SetFields.Reps) ? set.reps : null,
      repsMax: keep.has(SetFields.Reps) ? set.repsMax : null,
      weightKg: keep.has(SetFields.Weight) ? set.weightKg : null,
      durationSeconds: keep.has(SetFields.Duration) ? set.durationSeconds : null,
      distanceMeters: keep.has(SetFields.Distance) ? set.distanceMeters : null,
    })),
  };
}

/**
 * The exercise's own rest after its sets: what its first working set rests,
 * or null when it takes the routine's. A warm-up's rest is its own business.
 */
export function exerciseRest(row: DraftExercise): number | null {
  const working = row.sets.find((set) => set.setType !== ExerciseSetType.Warmup);
  return working?.restAfterSeconds ?? null;
}

/** Every working set of the exercise rests `seconds`; null hands it back to the routine's. */
export function withExerciseRest(row: DraftExercise, seconds: number | null): DraftExercise {
  return {
    ...row,
    sets: row.sets.map((set) =>
      set.setType === ExerciseSetType.Warmup ? set : { ...set, restAfterSeconds: seconds },
    ),
  };
}

/** Moves the row at `from` to `to`, the rest keeping their order. */
export function moveItem<T>(rows: readonly T[], from: number, to: number): T[] {
  const next = [...rows];
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

/** Is this row linked to the one after it? */
export function linkedToNext(rows: readonly DraftExercise[], index: number): boolean {
  const group = rows[index]?.supersetGroupId ?? null;
  return group !== null && rows[index + 1]?.supersetGroupId === group;
}

/** The link chip between two rows: links them as a superset, or undoes the link. */
export function toggledLink(rows: readonly DraftExercise[], index: number): DraftExercise[] {
  return linkedToNext(rows, index) ? unlinkFromNext(rows, index) : linkWithNext(rows, index);
}

/**
 * The sets stepper: one more is a set like the last (`nextSet`), one fewer
 * takes the last set off. Never below one: a routine names the movement.
 */
export function withSetCount(row: DraftExercise, delta: 1 | -1, key: string): DraftExercise {
  if (delta === 1) return { ...row, sets: [...row.sets, nextSet(row, key)] };
  return row.sets.length > 1 ? { ...row, sets: row.sets.slice(0, -1) } : row;
}

function setPayload(set: DraftSet): CreateRoutineSetPayload {
  return {
    setType: set.setType,
    ...(set.reps !== null
      ? { targetRepsMin: set.reps, targetRepsMax: set.repsMax ?? set.reps }
      : {}),
    ...(set.weightKg !== null ? { targetWeightKg: set.weightKg } : {}),
    ...(set.durationSeconds !== null ? { targetDurationSeconds: set.durationSeconds } : {}),
    ...(set.distanceMeters !== null ? { targetDistanceMeters: set.distanceMeters } : {}),
    ...(set.restAfterSeconds !== null ? { restAfterSeconds: set.restAfterSeconds } : {}),
  };
}

/**
 * The exercises as the API saves them: every set as its own row, so a
 * pyramid, a warm-up, a hold's time and a set's rest all survive the save.
 * The API replaces a routine's whole list on every save, so whatever is left
 * out here is gone. An exercise whose sets were all deleted keeps one empty
 * set: a routine names the movement even with nothing planned for it.
 */
export function payloadExercises(rows: readonly DraftExercise[]): CreateRoutineExercisePayload[] {
  return normalizeSupersets(rows).map((row) => ({
    exerciseId: row.exerciseId,
    ...(row.sets.length ? { sets: row.sets.map(setPayload) } : { defaultSets: 1 }),
    ...(row.supersetGroupId !== null ? { supersetGroupId: row.supersetGroupId } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  }));
}

/**
 * What a save would send, as one string: two drafts that would save the
 * same are the same, whatever their keys or which columns are showing.
 */
export function draftSignature(
  name: string,
  defaultRest: number | null,
  rows: readonly DraftExercise[],
  notes = '',
): string {
  return JSON.stringify({
    name: name.trim(),
    notes: notes.trim(),
    defaultRest,
    exercises: payloadExercises(rows),
  });
}

// ─── An exercise's verbs ─────────────────────────────────────────────────

/**
 * What an exercise card's ⋮ offers while building. The card keeps its
 * targets, its rest and Remove, its name opens the movement's page, and the
 * chip between two cards links them; the sheet holds the rest.
 */
export const BuilderExerciseActionIds = {
  MoveUp: 'moveUp',
  MoveDown: 'moveDown',
  Swap: 'swap',
  Reorder: 'reorder',
} as const;

export type BuilderExerciseActionId =
  (typeof BuilderExerciseActionIds)[keyof typeof BuilderExerciseActionIds];

/**
 * The verbs for the exercise at `index` of `count`. Move up and Move down
 * (only where there is room) are the one-tap way to change the order: the
 * drag mode stays (user decision, 2026-11-16) but cannot be reached by a
 * keyboard or a screen reader, and WCAG 2.5.7 asks for a way that needs no
 * dragging (user decision, 2026-11-17). Reorder only with two exercises or
 * more.
 *
 * Tiles by concept (`lists.md`): the order in navy, swapping honey (it edits
 * the exercise). Move down takes the sky so the two moves never share a hue,
 * and Swap sits between the moves and Reorder, so no two neighbours do
 * either, whichever rows show.
 */
export function builderExerciseActions(
  index: number,
  count: number,
): SheetAction<BuilderExerciseActionId>[] {
  const actions: SheetAction<BuilderExerciseActionId>[] = [];
  if (index > 0) {
    actions.push({
      id: BuilderExerciseActionIds.MoveUp,
      label: 'workouts.routineBuilder.actions.moveUp',
      icon: 'chevron-up-outline',
      color: 'secondary',
    });
  }
  if (index < count - 1) {
    actions.push({
      id: BuilderExerciseActionIds.MoveDown,
      label: 'workouts.routineBuilder.actions.moveDown',
      icon: 'chevron-down-outline',
      color: 'info',
      tone: 'shade',
    });
  }
  actions.push({
    id: BuilderExerciseActionIds.Swap,
    label: 'workouts.exerciseActions.swap',
    icon: 'repeat-outline',
    color: 'primary',
  });
  if (count > 1) {
    actions.push({
      id: BuilderExerciseActionIds.Reorder,
      label: 'workouts.routineBuilder.actions.reorder',
      icon: 'reorder-three-outline',
      color: 'secondary',
    });
  }
  return actions;
}

// ─── The header's ⋯ ──────────────────────────────────────────────────────

/** What the builder's ⋯ offers, as the workout's ⋯ does for a workout. */
export const BuilderOptionIds = {
  AddExercises: 'addExercises',
  Reorder: 'reorder',
  Discard: 'discard',
} as const;

export type BuilderOptionId = (typeof BuilderOptionIds)[keyof typeof BuilderOptionIds];

/**
 * Add exercises first (honey, it edits the routine, as in the workout's ⋯),
 * Reorder once there are two (navy), and Discard only once there is
 * something to lose: red, in its own card. Discarding a new routine drops
 * it; discarding while editing a saved one drops the changes.
 */
export function builderOptions(
  canReorder: boolean,
  discard: 'new' | 'edit' | null,
): SheetAction<BuilderOptionId>[] {
  return [
    {
      id: BuilderOptionIds.AddExercises,
      label: 'workouts.loggerOptions.addExercises',
      icon: 'add-outline',
      color: 'primary',
    },
    ...(canReorder
      ? [
          {
            id: BuilderOptionIds.Reorder,
            label: 'workouts.routineBuilder.actions.reorder',
            icon: 'reorder-three-outline',
            color: 'secondary',
          } satisfies SheetAction<BuilderOptionId>,
        ]
      : []),
    ...(discard
      ? [
          {
            id: BuilderOptionIds.Discard,
            label:
              discard === 'new'
                ? 'workouts.routineBuilder.options.discardNew'
                : 'workouts.routineBuilder.options.discardEdit',
            icon: 'trash-outline',
            color: 'danger',
            destructive: true,
          } satisfies SheetAction<BuilderOptionId>,
        ]
      : []),
  ];
}
