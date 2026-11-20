import { describe, expect, it } from 'vitest';

import { ExerciseSetType, PrescribedExercise, PrescribedSet } from 'core';

import {
  NO_EXTRAS,
  blockTags,
  dayBlocks,
  draftFromPrescribed,
  exerciseRpe,
  extrasFromDay,
  linkChanges,
  movedOrder,
  rpeOptions,
  setItems,
  tempoOptions,
  unlinkChanges,
  withWarmup,
  withWorkingExtras,
} from './day-editor.config';

function set(id: string, orderIndex: number, over: Partial<PrescribedSet> = {}): PrescribedSet {
  return {
    id,
    prescribedExerciseId: 'pe-1',
    orderIndex,
    setType: ExerciseSetType.Normal,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetWeightKg: 60,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: null,
    targetRir: null,
    restAfterSeconds: 120,
    tempo: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function exercise(sets: PrescribedSet[], over: Partial<PrescribedExercise> = {}): PrescribedExercise {
  return {
    id: 'pe-1',
    programWorkoutId: 'pw-1',
    exerciseId: 'ex-bench',
    blockId: null,
    supersetGroupId: null,
    orderIndex: 0,
    notes: null,
    alternateExerciseId: null,
    exercise: {
      id: 'ex-bench',
      name: 'Bench press',
      slug: 'bench-press',
      kind: 'STRENGTH',
      level: 'BEGINNER',
      thumbnailUrl: null,
    },
    sets,
    ...over,
  };
}

/** Rows A1 B1 C D E2 F2, as the superset helpers take them. */
const day = [1, 1, null, null, 2, 2].map((supersetGroupId, index) => ({
  id: 'abcdef'[index],
  supersetGroupId,
}));

describe('a program day as the builder edits it', () => {
  it('keys every exercise and set by its id, in order, the same for every set when they agree', () => {
    const row = draftFromPrescribed(exercise([set('s-2', 1), set('s-1', 0)]), 'Exercise', false);
    expect(row.key).toBe('pe-1');
    expect(row.name).toBe('Bench press');
    expect(row.sets.map((s) => s.key)).toEqual(['s-1', 's-2']);
    expect(row.sets[0]).toMatchObject({ reps: 8, repsMax: 10, weightKg: 60, restAfterSeconds: 120 });
    expect(row.perSet).toBe(false);
  });

  it('opens set by set when the sets differ, or when the coach chose so', () => {
    const warm = draftFromPrescribed(
      exercise([set('s-1', 0, { setType: ExerciseSetType.Warmup }), set('s-2', 1)]),
      'Exercise',
      false,
    );
    expect(warm.perSet).toBe(true);
    expect(draftFromPrescribed(exercise([set('s-1', 0)]), 'Exercise', true).perSet).toBe(true);
  });

  it('asks for reps each side on one-sided work', () => {
    const base = exercise([set('s-1', 0)]);
    const row = draftFromPrescribed(
      { ...base, exercise: { ...base.exercise!, isUnilateral: true } },
      'Exercise',
      false,
    );
    expect(row.unilateral).toBe(true);
  });
});

describe("saving one exercise's sets", () => {
  it('sends saved sets with their ids and new ones without, each with its whole target', () => {
    const saved = exercise([set('s-1', 0, { targetRpe: 8, tempo: '3-1-1-0', targetRir: 2 })]);
    const row = draftFromPrescribed(saved, 'Exercise', false);
    const extras = extrasFromDay([saved]);
    const grown = { ...row, sets: [...row.sets, { ...row.sets[0], key: 'new:1' }] };

    expect(setItems(grown, extras)).toEqual([
      {
        id: 's-1',
        setType: 'NORMAL',
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetWeightKg: 60,
        restAfterSeconds: 120,
        targetRpe: 8,
        targetRir: 2,
        tempo: '3-1-1-0',
      },
      // A new set takes the set before it's effort and tempo, not its note.
      {
        setType: 'NORMAL',
        targetRepsMin: 8,
        targetRepsMax: 10,
        targetWeightKg: 60,
        restAfterSeconds: 120,
        targetRpe: 8,
        targetRir: 2,
        tempo: '3-1-1-0',
      },
    ]);
  });

  it('keeps a percentage of 1RM the web set, until a weight in kilograms replaces it', () => {
    const saved = exercise([set('s-1', 0, { targetWeightKg: null, targetWeightPercent1rm: 75 })]);
    const row = draftFromPrescribed(saved, 'Exercise', false);
    const extras = extrasFromDay([saved]);
    expect(setItems(row, extras)[0]).toMatchObject({ targetWeightPercent1rm: 75 });
    expect(setItems(row, extras)[0].targetWeightKg).toBeUndefined();

    const weighed = { ...row, sets: [{ ...row.sets[0], weightKg: 50 }] };
    expect(setItems(weighed, extras)[0].targetWeightPercent1rm).toBeUndefined();
    expect(setItems(weighed, extras)[0].targetWeightKg).toBe(50);
  });

  it('sets one reps target as min and max, and clears what a set has no value for', () => {
    const row = draftFromPrescribed(exercise([set('s-1', 0)]), 'Exercise', false);
    const plain = { ...row, sets: [{ ...row.sets[0], reps: 5, repsMax: null, weightKg: null }] };
    expect(setItems(plain, {})[0]).toEqual({
      id: 's-1',
      setType: 'NORMAL',
      targetRepsMin: 5,
      targetRepsMax: 5,
      restAfterSeconds: 120,
    });
  });

  it('puts an effort on the working sets only, and a new warm-up takes none', () => {
    const saved = exercise([set('s-1', 0, { setType: ExerciseSetType.Warmup }), set('s-2', 1)]);
    const row = draftFromPrescribed(saved, 'Exercise', false);
    const extras = withWorkingExtras(row, extrasFromDay([saved]), { targetRpe: 8.5 });
    expect(extras['s-1'].targetRpe).toBeNull();
    expect(extras['s-2'].targetRpe).toBe(8.5);
    expect(exerciseRpe(row, extras)).toBe(8.5);

    const warmed = withWarmup(row, 'new:1');
    const items = setItems(warmed, extras);
    expect(items[1]).toMatchObject({ setType: 'WARMUP', targetRepsMin: 8 });
    expect(items[1].targetRpe).toBeUndefined();
  });

  it('adds a warm-up before the working sets, after the warm-ups already there', () => {
    const row = draftFromPrescribed(
      exercise([set('s-1', 0, { setType: ExerciseSetType.Warmup }), set('s-2', 1)]),
      'Exercise',
      false,
    );
    const warmed = withWarmup(row, 'new:1');
    expect(warmed.sets.map((s) => s.key)).toEqual(['s-1', 'new:1', 's-2']);
    expect(warmed.sets[1]).toMatchObject({ setType: 'WARMUP', reps: 8, weightKg: null });
    expect(warmed.perSet).toBe(true);
    expect(NO_EXTRAS.targetRpe).toBeNull();
  });
});

describe('supersets as blocks', () => {
  it('groups a superset into one block and labels its members 1A, 1B by the block', () => {
    expect(dayBlocks(day)).toEqual([[0, 1], [2], [3], [4, 5]]);
    expect(blockTags(day)).toEqual(['1A', '1B', null, null, '4A', '4B']);
  });

  it('keeps two supersets with the same number apart when they are not neighbours', () => {
    const rows = [1, null, 1].map((supersetGroupId) => ({ supersetGroupId }));
    expect(dayBlocks(rows)).toEqual([[0], [1], [2]]);
  });

  it('moves a member inside its superset, and a block past its neighbour, never splitting one', () => {
    // B up: it trades places with A, inside the superset.
    expect(movedOrder(day, 1, -1)).toEqual([1, 0, 2, 3, 4, 5]);
    // A up: the superset is first already.
    expect(movedOrder(day, 0, -1)).toBeNull();
    // B down: past the superset's edge, the whole superset moves after C.
    expect(movedOrder(day, 1, 1)).toEqual([2, 0, 1, 3, 4, 5]);
    // D down: over the whole E and F superset.
    expect(movedOrder(day, 3, 1)).toEqual([0, 1, 2, 4, 5, 3]);
    expect(movedOrder(day, 5, 1)).toBeNull();
  });

  it('links a block with the next and unlinks a superset, as the one save takes them', () => {
    expect(linkChanges(day, 2)).toEqual([
      { id: 'c', supersetGroupId: 2 },
      { id: 'd', supersetGroupId: 2 },
      { id: 'e', supersetGroupId: 3 },
      { id: 'f', supersetGroupId: 3 },
    ]);
    expect(unlinkChanges(day, [4, 5])).toEqual([
      { id: 'e', supersetGroupId: null },
      { id: 'f', supersetGroupId: null },
    ]);
  });
});

describe('effort and tempo sheets', () => {
  it('offers no target, then 6 to 10 by halves', () => {
    const options = rpeOptions();
    expect(options[0]).toEqual({ value: '', label: 'No target' });
    expect(options.map((o) => o.value).slice(1, 3)).toEqual(['6', '6.5']);
    expect(options[options.length - 1]).toEqual({ value: '10', label: 'RPE 10' });
  });

  it("keeps an exercise's own tempo among the choices", () => {
    expect(tempoOptions(null).map((o) => o.value)).not.toContain('6-0-1-0');
    expect(tempoOptions('6-0-1-0').map((o) => o.value)).toContain('6-0-1-0');
    expect(tempoOptions('3-1-1-0').filter((o) => o.value === '3-1-1-0')).toHaveLength(1);
  });
});
