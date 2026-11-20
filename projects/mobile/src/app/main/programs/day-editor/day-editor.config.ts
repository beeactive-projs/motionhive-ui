import {
  ExerciseKind,
  ExerciseSetType,
  PrescribedExercise,
  PrescribedSet,
  PrescribedSetItem,
  linkWithNext,
  supersetChanges,
  translate,
} from 'core';

import { ChoiceOption } from '../../../_shared/components/choice-sheet/choice-sheet';
import { formatMeasure, SetTarget } from '../../workouts/workouts.config';
import {
  DraftExercise,
  DraftSet,
  emptySet,
  isUniform,
} from '../../workouts/routine-builder/routine-builder.config';

/**
 * The program day editor's pure parts: a day's exercises as the routine
 * builder's drafts (so its steppers, set rows and pad draw them as they are),
 * and back into the one request that saves an exercise's sets.
 */

/**
 * A set the server has not seen yet is keyed by this and a number. A saved
 * set is keyed by its own id, which is what lets the save update it in place:
 * the client's assigned copy points back at that row by id.
 */
export const NEW_SET_PREFIX = 'new:';

/** True for a key the save sends without an id, so the server adds a set. */
export function isNewSetKey(key: string): boolean {
  return key.startsWith(NEW_SET_PREFIX);
}

/**
 * What a set holds that the drafts do not draw: an effort and a tempo the
 * coach sets for the whole exercise, a note on one set, and what the web
 * sets (reps in reserve, a percentage of 1RM). Kept beside the drafts, by
 * set key, so a save from the phone never clears them.
 */
export interface SetExtras {
  targetRpe: number | null;
  targetRir: number | null;
  targetWeightPercent1rm: number | null;
  tempo: string | null;
  notes: string | null;
}

export const NO_EXTRAS: SetExtras = {
  targetRpe: null,
  targetRir: null,
  targetWeightPercent1rm: null,
  tempo: null,
  notes: null,
};

/** Extras by set key. */
export type ExtrasByKey = Readonly<Record<string, SetExtras>>;

export function extrasOf(set: PrescribedSet): SetExtras {
  return {
    targetRpe: set.targetRpe ?? null,
    targetRir: set.targetRir ?? null,
    targetWeightPercent1rm: set.targetWeightPercent1rm ?? null,
    tempo: set.tempo ?? null,
    notes: set.notes ?? null,
  };
}

/** One saved set as the builder's draft draws it, keyed by its id. */
export function draftSetOf(set: PrescribedSet): DraftSet {
  const min = set.targetRepsMin ?? null;
  const max = set.targetRepsMax ?? null;
  let reps = min;
  if (reps === null) {
    reps = max;
  }
  let repsMax: number | null = null;
  if (min !== null && max !== null && max !== min) {
    repsMax = max;
  }
  return {
    key: set.id,
    setType: set.setType || ExerciseSetType.Normal,
    reps,
    repsMax,
    weightKg: set.targetWeightKg ?? null,
    durationSeconds: set.targetDurationSeconds ?? null,
    distanceMeters: set.targetDistanceMeters ?? null,
    restAfterSeconds: set.restAfterSeconds ?? null,
  };
}

/**
 * A day's exercise as the builder edits it, keyed by its own id. Planned set
 * by set when its sets differ (a warm-up, a pyramid) or when the coach chose
 * so on this screen (`perSet`), so the steppers never flatten them unasked.
 */
export function draftFromPrescribed(
  row: PrescribedExercise,
  fallbackName: string,
  perSet: boolean,
): DraftExercise {
  const saved = [...(row.sets ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const sets = saved.map(draftSetOf);
  const exercise = row.exercise;
  let kind: ExerciseKind | null = null;
  let name = fallbackName;
  let thumbnailUrl: string | null = null;
  let unilateral = false;
  if (exercise) {
    kind = exercise.kind as ExerciseKind;
    name = exercise.name;
    thumbnailUrl = exercise.thumbnailUrl;
    unilateral = exercise.isUnilateral === true;
  }
  const weighted = sets.some((set) => set.weightKg !== null);
  return {
    key: row.id,
    exerciseId: row.exerciseId,
    name,
    kind,
    thumbnailUrl,
    unilateral,
    notes: row.notes,
    supersetGroupId: row.supersetGroupId,
    addedWeight: kind === ExerciseKind.Bodyweight && weighted,
    perSet: perSet || (sets.length > 0 && !isUniform(sets)),
    sets,
  };
}

/** Every saved set's extras, by its id. */
export function extrasFromDay(rows: readonly PrescribedExercise[]): Record<string, SetExtras> {
  const extras: Record<string, SetExtras> = {};
  for (const row of rows) {
    for (const set of row.sets ?? []) {
      extras[set.id] = extrasOf(set);
    }
  }
  return extras;
}

/**
 * The extras each set is saved with. A set with its own keeps them; a new
 * set takes the ones of the set before it (Add set copies the last set, and
 * its effort and tempo with it). A new warm-up takes none: a warm-up has no
 * effort target.
 */
export function extrasForSets(row: DraftExercise, extras: ExtrasByKey): SetExtras[] {
  const out: SetExtras[] = [];
  let last: SetExtras = NO_EXTRAS;
  for (const set of row.sets) {
    const own = extras[set.key];
    if (own) {
      out.push(own);
      if (set.setType !== ExerciseSetType.Warmup) {
        last = own;
      }
      continue;
    }
    if (set.setType === ExerciseSetType.Warmup) {
      out.push(NO_EXTRAS);
      continue;
    }
    out.push({ ...last, notes: null });
  }
  return out;
}

/**
 * The exercise's sets as one save sends them: every set's whole target, a
 * saved one with its id. What a set has no value for is left out, which the
 * save reads as cleared. A weight in kilograms wins over a percentage, since
 * the API takes one of the two.
 */
export function setItems(row: DraftExercise, extras: ExtrasByKey): PrescribedSetItem[] {
  const allExtras = extrasForSets(row, extras);
  return row.sets.map((set, index) => {
    const item: PrescribedSetItem = { setType: set.setType };
    if (!isNewSetKey(set.key)) {
      item.id = set.key;
    }
    if (set.reps !== null) {
      item.targetRepsMin = set.reps;
      item.targetRepsMax = set.reps;
      if (set.repsMax !== null) {
        item.targetRepsMax = set.repsMax;
      }
    }
    if (set.weightKg !== null) {
      item.targetWeightKg = set.weightKg;
    }
    if (set.durationSeconds !== null) {
      item.targetDurationSeconds = set.durationSeconds;
    }
    if (set.distanceMeters !== null) {
      item.targetDistanceMeters = set.distanceMeters;
    }
    if (set.restAfterSeconds !== null) {
      item.restAfterSeconds = set.restAfterSeconds;
    }
    const own = allExtras[index];
    if (own.targetRpe !== null) {
      item.targetRpe = own.targetRpe;
    }
    if (own.targetRir !== null) {
      item.targetRir = own.targetRir;
    }
    if (own.targetWeightPercent1rm !== null && set.weightKg === null) {
      item.targetWeightPercent1rm = own.targetWeightPercent1rm;
    }
    if (own.tempo !== null) {
      item.tempo = own.tempo;
    }
    if (own.notes !== null) {
      item.notes = own.notes;
    }
    return item;
  });
}

/** The first set that is not a warm-up: the one an exercise's effort and tempo read from. */
function firstWorkingIndex(row: DraftExercise): number {
  return row.sets.findIndex((set) => set.setType !== ExerciseSetType.Warmup);
}

/** The exercise's target effort: its first working set's, or null. */
export function exerciseRpe(row: DraftExercise, extras: ExtrasByKey): number | null {
  const index = firstWorkingIndex(row);
  if (index < 0) {
    return null;
  }
  return extrasForSets(row, extras)[index].targetRpe;
}

/** The exercise's tempo: its first working set's, or null. */
export function exerciseTempo(row: DraftExercise, extras: ExtrasByKey): string | null {
  const index = firstWorkingIndex(row);
  if (index < 0) {
    return null;
  }
  return extrasForSets(row, extras)[index].tempo;
}

/**
 * Every working set of the exercise with `change` applied (an effort, a
 * tempo); warm-ups keep theirs. Answers the extras to keep, by key.
 */
export function withWorkingExtras(
  row: DraftExercise,
  extras: ExtrasByKey,
  change: Partial<SetExtras>,
): Record<string, SetExtras> {
  const next: Record<string, SetExtras> = { ...extras };
  const current = extrasForSets(row, extras);
  row.sets.forEach((set, index) => {
    if (set.setType === ExerciseSetType.Warmup) {
      return;
    }
    next[set.key] = { ...current[index], ...change };
  });
  return next;
}

/**
 * A warm-up set to add before the working sets, after any warm-ups already
 * there: the reps of the first working set, nothing heavier planned yet.
 */
export function withWarmup(row: DraftExercise, key: string): DraftExercise {
  const warmup: DraftSet = { ...emptySet(key), setType: ExerciseSetType.Warmup };
  const working = firstWorkingIndex(row);
  let at = row.sets.length;
  if (working >= 0) {
    at = working;
    warmup.reps = row.sets[working].reps;
  }
  const sets = [...row.sets];
  sets.splice(at, 0, warmup);
  return { ...row, perSet: true, sets };
}

/** The draft's sets as `prescriptionLine` reads them, for the card's line. */
export function draftTargets(row: DraftExercise): SetTarget[] {
  return row.sets.map((set) => {
    let max = set.reps;
    if (set.repsMax !== null) {
      max = set.repsMax;
    }
    return {
      targetRepsMin: set.reps,
      targetRepsMax: max,
      targetWeightKg: set.weightKg,
      targetDurationSeconds: set.durationSeconds,
      targetDistanceMeters: set.distanceMeters,
    };
  });
}

// ─── Supersets as blocks ─────────────────────────────────────────────────

/**
 * The day in blocks: an exercise on its own is a block, and the exercises of
 * a superset (next to each other, sharing a group) are one. Each block is
 * the indexes of its rows.
 */
export function dayBlocks(rows: readonly Pick<DraftExercise, 'supersetGroupId'>[]): number[][] {
  const blocks: number[][] = [];
  rows.forEach((row, index) => {
    const group = row.supersetGroupId;
    const previous = blocks[blocks.length - 1];
    if (group !== null && previous) {
      const before = rows[previous[previous.length - 1]];
      if (before.supersetGroupId === group) {
        previous.push(index);
        return;
      }
    }
    blocks.push([index]);
  });
  return blocks;
}

/**
 * "3A", "3B": a superset member's label, by its block's place in the day and
 * its own in the superset (design "DayEditor"). Null for an exercise on its
 * own, which needs no letter.
 */
export function blockTags(rows: readonly Pick<DraftExercise, 'supersetGroupId'>[]): (string | null)[] {
  const tags: (string | null)[] = rows.map(() => null);
  dayBlocks(rows).forEach((block, position) => {
    if (block.length < 2) {
      return;
    }
    block.forEach((rowIndex, member) => {
      tags[rowIndex] = `${position + 1}${String.fromCharCode(65 + member)}`;
    });
  });
  return tags;
}

/**
 * The day's order after moving the row at `index` one place (`delta`), as
 * row indexes, or null when it cannot move. Inside a superset a member trades
 * places with its neighbour in it; past the superset's edge, or for an
 * exercise on its own, the whole block trades places with the block beside
 * it. So a move never splits a superset or lands inside one, and one reorder
 * saves it.
 */
export function movedOrder(
  rows: readonly Pick<DraftExercise, 'supersetGroupId'>[],
  index: number,
  delta: -1 | 1,
): number[] | null {
  const blocks = dayBlocks(rows);
  const at = blocks.findIndex((block) => block.includes(index));
  if (at < 0) {
    return null;
  }
  const block = blocks[at];
  const member = block.indexOf(index);
  const swapWith = member + delta;
  if (block.length > 1 && swapWith >= 0 && swapWith < block.length) {
    const members = [...block];
    members[member] = block[swapWith];
    members[swapWith] = block[member];
    const next = [...blocks];
    next[at] = members;
    return next.flat();
  }
  const target = at + delta;
  if (target < 0 || target >= blocks.length) {
    return null;
  }
  const next = [...blocks];
  next[at] = blocks[target];
  next[target] = block;
  return next.flat();
}

/** The superset changes that link the block ending at `lastIndex` with the next one. */
export function linkChanges<T extends Pick<DraftExercise, 'supersetGroupId'> & { id: string }>(
  rows: readonly T[],
  lastIndex: number,
): { id: string; supersetGroupId: number | null }[] {
  return supersetChanges(rows, linkWithNext(rows, lastIndex));
}

/** The superset changes that take every member of one block out of its superset. */
export function unlinkChanges<T extends Pick<DraftExercise, 'supersetGroupId'> & { id: string }>(
  rows: readonly T[],
  members: readonly number[],
): { id: string; supersetGroupId: number | null }[] {
  const after = rows.map((row, index) => {
    if (members.includes(index)) {
      return { ...row, supersetGroupId: null };
    }
    return row;
  });
  return supersetChanges(rows, after);
}

// ─── Effort and tempo ────────────────────────────────────────────────────

/** The value an effort or tempo sheet uses for "none". */
export const NO_TARGET = '';

/** Target efforts offered, half a point apart: below 6 is a warm-up's business. */
export const RPE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/** Common tempos (down, pause, up, pause), slowest lowering last. */
export const TEMPO_CHOICES = ['2-0-1-0', '2-0-2-0', '3-0-1-0', '3-1-1-0', '3-1-3-1', '4-0-1-0', '5-0-1-0'] as const;

/** "RPE 8" for the chip and the sheet's rows. */
export function rpeLabel(value: number): string {
  return translate('programs.dayEditor.targets.rpe', { value: formatMeasure(value, 1) });
}

/** The effort sheet: none, then 6 to 10 by halves. */
export function rpeOptions(): ChoiceOption[] {
  return [
    { value: NO_TARGET, label: translate('programs.dayEditor.targets.noRpe') },
    ...RPE_CHOICES.map((value) => ({ value: String(value), label: rpeLabel(value) })),
  ];
}

/** The tempo sheet: none, the common ones, and the exercise's own when it is another. */
export function tempoOptions(current: string | null): ChoiceOption[] {
  const tempos: string[] = [...TEMPO_CHOICES];
  if (current && !tempos.includes(current)) {
    tempos.push(current);
  }
  return [
    { value: NO_TARGET, label: translate('programs.dayEditor.targets.noTempo') },
    ...tempos.map((tempo) => ({ value: tempo, label: tempo })),
  ];
}
