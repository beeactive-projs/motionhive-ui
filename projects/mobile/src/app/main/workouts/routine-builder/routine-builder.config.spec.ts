/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { Exercise, ExerciseKind, ExerciseSetType, RoutineExercise, SetFields } from 'core';

import {
  BuilderExerciseActionIds,
  BuilderOptionIds,
  DraftExercise,
  DraftSet,
  builderExerciseActions,
  builderOptions,
  copyOfSet,
  draftFields,
  draftFromPick,
  draftFromRoutine,
  draftSignature,
  emptySet,
  exerciseRest,
  flattened,
  isUniform,
  linkWithNext,
  moveItem,
  nextSet,
  normalizeSupersets,
  payloadExercises,
  repsRangeText,
  stepperFields,
  steppedAll,
  supersetTags,
  swapped,
  toggledLink,
  unlinkFromNext,
  withAll,
  withExerciseRest,
  withSetCount,
  withValue,
} from './routine-builder.config';

const rows = (...groups: (number | null)[]) => groups.map((supersetGroupId, i) => ({ id: i, supersetGroupId }));
const groups = (list: { supersetGroupId: number | null }[]) => list.map((r) => r.supersetGroupId);

describe('superset links in the builder', () => {
  it('links two rows into a superset, and a third onto it', () => {
    const linked = linkWithNext(rows(null, null, null), 0);
    expect(groups(linked)).toEqual([1, 1, null]);
    expect(groups(linkWithNext(linked, 1))).toEqual([1, 1, 1]);
  });

  it('merges two supersets when the rows between them are linked', () => {
    expect(groups(linkWithNext(rows(1, 1, 2, 2), 1))).toEqual([1, 1, 1, 1]);
  });

  it('unlinks, leaving a row alone unlinked', () => {
    expect(groups(unlinkFromNext(rows(1, 1), 0))).toEqual([null, null]);
    expect(groups(unlinkFromNext(rows(1, 1, 1), 0))).toEqual([null, 1, 1]);
    expect(groups(unlinkFromNext(rows(1, 1, 1, 1), 1))).toEqual([1, 1, 2, 2]);
  });

  it('cleans a group of one left behind by a removal', () => {
    expect(groups(normalizeSupersets(rows(3, null, 3, 3)))).toEqual([null, null, 1, 1]);
  });

  it('tags rows A1, A2, B1', () => {
    expect(supersetTags(rows(1, 1, null, 2, 2))).toEqual(['A1', 'A2', null, 'B1', 'B2']);
  });
});

/** Keys as the page makes them: one counter, so every key is new. */
function keys(): () => string {
  let n = 0;
  return () => `k${++n}`;
}

function picked(partial: Partial<Exercise> = {}): Exercise {
  return {
    id: 'squat',
    name: 'Back squat',
    kind: ExerciseKind.Strength,
    thumbnailUrl: null,
    isUnilateral: false,
    ...partial,
  } as Exercise;
}

function saved(partial: Partial<RoutineExercise> = {}): RoutineExercise {
  return {
    id: 'pe-1',
    exerciseId: 'bench',
    orderIndex: 0,
    supersetGroupId: null,
    notes: null,
    defaultSets: 3,
    targetRepsMin: null,
    targetRepsMax: null,
    targetWeightKg: null,
    restAfterSeconds: null,
    sets: [],
    hasVariedSets: false,
    exercise: { id: 'bench', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', thumbnailUrl: null },
    ...partial,
  };
}

const plannedSet = (partial: Partial<RoutineExercise['sets'][number]> = {}) => ({
  setType: ExerciseSetType.Normal,
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeightKg: null,
  targetDurationSeconds: null,
  targetDistanceMeters: null,
  restAfterSeconds: null,
  ...partial,
});

function draft(partial: Partial<DraftExercise> = {}, sets: Partial<DraftSet>[] = [{}]): DraftExercise {
  const key = keys();
  return {
    key: 'row',
    exerciseId: 'bench',
    name: 'Bench press',
    kind: ExerciseKind.Strength,
    thumbnailUrl: null,
    unilateral: false,
    notes: null,
    supersetGroupId: null,
    addedWeight: false,
    perSet: false,
    sets: sets.map((set) => ({ ...emptySet(key()), ...set })),
    ...partial,
  };
}

describe('the draft', () => {
  it('adds a picked movement with three empty sets, as the logger does', () => {
    const row = draftFromPick(picked(), keys());

    expect(row).toMatchObject({ exerciseId: 'squat', name: 'Back squat', kind: ExerciseKind.Strength });
    expect(row.sets).toHaveLength(3);
    expect(row.sets.every((set) => set.setType === ExerciseSetType.Normal && set.reps === null)).toBe(true);
    expect(new Set([row.key, ...row.sets.map((set) => set.key)]).size).toBe(4);
  });

  // The old builder kept one reps and weight per exercise and saved them as
  // N identical sets, so a pyramid, a warm-up or a hold's time was lost on
  // every edit.
  it('keeps every saved set as it is: a pyramid, its warm-up, its rest', () => {
    const row = draftFromRoutine(
      saved({
        sets: [
          plannedSet({ setType: ExerciseSetType.Warmup, targetRepsMin: 10, targetRepsMax: 10, targetWeightKg: 20 }),
          plannedSet({ targetRepsMin: 8, targetRepsMax: 8, targetWeightKg: 60, restAfterSeconds: 120 }),
          plannedSet({ targetRepsMin: 6, targetRepsMax: 6, targetWeightKg: 70, restAfterSeconds: 120 }),
        ],
      }),
      'Exercise',
      keys(),
    );

    expect(row.sets.map((set) => [set.setType, set.reps, set.weightKg, set.restAfterSeconds])).toEqual([
      [ExerciseSetType.Warmup, 10, 20, null],
      [ExerciseSetType.Normal, 8, 60, 120],
      [ExerciseSetType.Normal, 6, 70, 120],
    ]);
  });

  it('keeps a hold’s time, a run’s distance and a rep range', () => {
    const row = draftFromRoutine(
      saved({
        sets: [plannedSet({ targetRepsMin: 8, targetRepsMax: 12, targetDurationSeconds: 45, targetDistanceMeters: 400 })],
      }),
      'Exercise',
      keys(),
    );

    expect(row.sets[0]).toMatchObject({ reps: 8, repsMax: 12, durationSeconds: 45, distanceMeters: 400 });
    expect(repsRangeText(row.sets[0])).toBe('8–12');
  });

  it('stands an older routine’s flat summary in for its rows', () => {
    const row = draftFromRoutine(
      saved({ sets: [], defaultSets: 4, targetRepsMin: 5, targetRepsMax: 5, targetWeightKg: 100 }),
      'Exercise',
      keys(),
    );

    expect(row.sets).toHaveLength(4);
    expect(row.sets.every((set) => set.reps === 5 && set.weightKg === 100)).toBe(true);
  });

  it('shows the weight column on a bodyweight move saved with a weight', () => {
    const exercise = { id: 'dip', name: 'Dip', slug: 'dip', kind: 'BODYWEIGHT', thumbnailUrl: null };
    const loaded = draftFromRoutine(
      saved({ exerciseId: 'dip', exercise, sets: [plannedSet({ targetRepsMin: 8, targetWeightKg: 10 })] }),
      'Exercise',
      keys(),
    );
    const bare = draftFromRoutine(
      saved({ exerciseId: 'dip', exercise, sets: [plannedSet({ targetRepsMin: 8 })] }),
      'Exercise',
      keys(),
    );

    expect(draftFields(loaded)).toEqual([SetFields.Weight, SetFields.Reps]);
    expect(draftFields(bare)).toEqual([SetFields.Reps]);
  });

  // The catalogue files Plank under strength: its 45 s hold was saved and
  // read back, but the builder drew Reps and Weight only, so it could be
  // neither seen nor changed.
  it('shows a time or a distance the sets hold, whatever the kind says', () => {
    const plank = { id: 'plank', name: 'Plank', slug: 'plank', kind: 'STRENGTH', thumbnailUrl: null };
    const held = draftFromRoutine(
      saved({ exerciseId: 'plank', exercise: plank, sets: [plannedSet({ targetDurationSeconds: 45 })] }),
      'Exercise',
      keys(),
    );
    const carried = draftFromRoutine(
      saved({ sets: [plannedSet({ targetRepsMin: 8, targetDistanceMeters: 20 })] }),
      'Exercise',
      keys(),
    );

    expect(draftFields(held)).toEqual([SetFields.Weight, SetFields.Reps, SetFields.Duration]);
    expect(stepperFields(held)).toEqual([SetFields.Reps, SetFields.Duration, SetFields.Weight]);
    expect(draftFields(carried)).toEqual([SetFields.Weight, SetFields.Reps, SetFields.Distance]);
    expect(draftFields(draft())).toEqual([SetFields.Weight, SetFields.Reps]);
  });

  it('turns a range into the one number typed over it', () => {
    const set = { ...emptySet('s'), reps: 8, repsMax: 12 };

    expect(withValue(set, SetFields.Reps, 10)).toMatchObject({ reps: 10, repsMax: null });
    expect(withValue(set, SetFields.Weight, 60)).toMatchObject({ reps: 8, repsMax: 12, weightKg: 60 });
    expect(repsRangeText(withValue(set, SetFields.Reps, 10))).toBeNull();
  });

  it('adds the next set like the one before it, as a plain set', () => {
    const row = draft({}, [{ weightKg: 60, reps: 8 }, { setType: ExerciseSetType.Dropset, weightKg: 40, reps: 12 }]);

    expect(nextSet(row, 'new')).toMatchObject({
      key: 'new',
      setType: ExerciseSetType.Normal,
      weightKg: 40,
      reps: 12,
    });
    expect(nextSet(draft({}, []), 'new')).toEqual(emptySet('new'));
  });

  it('copies a set whole, type included', () => {
    const set = { ...emptySet('a'), setType: ExerciseSetType.Warmup, reps: 10 };

    expect(copyOfSet(set, 'b')).toEqual({ ...set, key: 'b' });
  });

  it('keeps on a swap only the targets the new movement records', () => {
    const plank = draft({ kind: ExerciseKind.Duration, exerciseId: 'plank' }, [{ durationSeconds: 60, reps: 3 }]);

    const row = swapped(plank, picked({ id: 'pushup', name: 'Push-up', kind: ExerciseKind.Bodyweight }), 'k');

    expect(row).toMatchObject({ key: 'k', exerciseId: 'pushup', name: 'Push-up', kind: ExerciseKind.Bodyweight });
    expect(row.sets[0]).toMatchObject({ reps: 3, durationSeconds: null });
  });

  it('reads and sets an exercise’s rest on its working sets, a warm-up keeping its own', () => {
    const row = draft({}, [
      { setType: ExerciseSetType.Warmup, restAfterSeconds: 45 },
      { restAfterSeconds: 90 },
      { restAfterSeconds: 90 },
    ]);
    expect(exerciseRest(row)).toBe(90);

    const changed = withExerciseRest(row, 150);
    expect(changed.sets.map((set) => set.restAfterSeconds)).toEqual([45, 150, 150]);
    expect(exerciseRest(withExerciseRest(row, null))).toBeNull();
  });

  it('moves a row to its new place', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  // The chip between two cards, as the builder always had it.
  it('links two exercises with the chip between them, and unlinks them again', () => {
    const list = [draft({ key: 'a' }), draft({ key: 'b' }), draft({ key: 'c' })];

    const linked = toggledLink(list, 0);
    expect(groups(linked)).toEqual([1, 1, null]);
    expect(groups(toggledLink(linked, 1))).toEqual([1, 1, 1]);
    expect(groups(toggledLink(linked, 0))).toEqual([null, null, null]);
  });

  // The stepper the builder always had, now over real rows.
  it('steps the sets up by a copy of the last, and down by the last, never below one', () => {
    const row = draft({}, [{ reps: 8, weightKg: 60 }, { setType: ExerciseSetType.Dropset, reps: 12, weightKg: 40 }]);

    const more = withSetCount(row, 1, 'k-new');
    expect(more.sets).toHaveLength(3);
    expect(more.sets[2]).toMatchObject({ key: 'k-new', setType: ExerciseSetType.Normal, reps: 12, weightKg: 40 });

    const fewer = withSetCount(row, -1, 'unused');
    expect(fewer.sets.map((set) => set.reps)).toEqual([8]);
    expect(withSetCount(fewer, -1, 'unused').sets).toHaveLength(1);
  });
});

describe('the steppers: the same for every set', () => {
  // Sets · Reps · Weight (kg), or Sets · Time · Weight (kg), by the exercise.
  it('steps the targets each kind is planned by, weight last', () => {
    const fields = (kind: ExerciseKind, addedWeight = false) => stepperFields(draft({ kind, addedWeight }));

    expect(fields(ExerciseKind.Strength)).toEqual([SetFields.Reps, SetFields.Weight]);
    expect(fields(ExerciseKind.Duration)).toEqual([SetFields.Duration, SetFields.Weight]);
    expect(fields(ExerciseKind.Bodyweight)).toEqual([SetFields.Reps]);
    expect(fields(ExerciseKind.Bodyweight, true)).toEqual([SetFields.Reps, SetFields.Weight]);
    expect(fields(ExerciseKind.Cardio)).toEqual([SetFields.Distance, SetFields.Duration]);
  });

  it('reads sets alike as the same, and a warm-up or a pyramid as not', () => {
    expect(isUniform(draft({}, [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }]).sets)).toBe(true);
    expect(isUniform(draft({}, [{ reps: 8, weightKg: 60 }, { reps: 6, weightKg: 70 }]).sets)).toBe(false);
    expect(
      isUniform(draft({}, [{ setType: ExerciseSetType.Warmup, reps: 8 }, { reps: 8 }]).sets),
    ).toBe(false);
    // Rest has its own chip; sets resting differently are still alike.
    expect(isUniform(draft({}, [{ restAfterSeconds: 60 }, { restAfterSeconds: 90 }]).sets)).toBe(true);
  });

  // An exercise whose sets differ opens set by set, so the steppers never flatten it unasked.
  it('opens a saved exercise set by set only when its sets differ', () => {
    const same = draftFromRoutine(saved({ sets: [plannedSet({ targetRepsMin: 8 }), plannedSet({ targetRepsMin: 8 })] }), 'E', keys());
    const pyramid = draftFromRoutine(
      saved({ sets: [plannedSet({ targetRepsMin: 8 }), plannedSet({ targetRepsMin: 6 })] }),
      'E',
      keys(),
    );

    expect(same.perSet).toBe(false);
    expect(pyramid.perSet).toBe(true);
    expect(draftFromPick(picked(), keys()).perSet).toBe(false);
  });

  it('steps every set by the pad’s step, from nothing up and down to nothing', () => {
    const row = draft({}, [{}, {}]);

    const weighted = steppedAll(row, SetFields.Weight, 1, 2.5);
    expect(weighted.sets.map((set) => set.weightKg)).toEqual([2.5, 2.5]);
    expect(steppedAll(weighted, SetFields.Weight, -1, 2.5).sets.map((set) => set.weightKg)).toEqual([null, null]);
    expect(steppedAll(row, SetFields.Weight, -1, 2.5).sets[0].weightKg).toBeNull();

    const timed = steppedAll(draft({ kind: ExerciseKind.Duration }, [{ durationSeconds: 45 }]), SetFields.Duration, 1, 15);
    expect(timed.sets[0].durationSeconds).toBe(60);
  });

  it('moves a rep range as a whole', () => {
    const row = draft({}, [{ reps: 8, repsMax: 12 }, { reps: 8, repsMax: 12 }]);

    expect(steppedAll(row, SetFields.Reps, 1, 1).sets.map((set) => [set.reps, set.repsMax])).toEqual([
      [9, 13],
      [9, 13],
    ]);
  });

  it('types one value into every set', () => {
    const row = withAll(draft({}, [{ reps: 8, repsMax: 12 }, {}]), SetFields.Reps, 10);

    expect(row.sets.map((set) => [set.reps, set.repsMax])).toEqual([
      [10, null],
      [10, null],
    ]);
  });

  it('flattens set by set back to the first working set’s targets, rests kept', () => {
    const row = draft({ perSet: true }, [
      { setType: ExerciseSetType.Warmup, reps: 12, weightKg: 20, restAfterSeconds: 45 },
      { reps: 8, weightKg: 60, restAfterSeconds: 90 },
      { setType: ExerciseSetType.Dropset, reps: 12, weightKg: 40, restAfterSeconds: 90 },
    ]);

    const flat = flattened(row, 'k-new');

    expect(flat.perSet).toBe(false);
    expect(flat.sets.map((set) => [set.setType, set.reps, set.weightKg, set.restAfterSeconds])).toEqual([
      [ExerciseSetType.Normal, 8, 60, 45],
      [ExerciseSetType.Normal, 8, 60, 90],
      [ExerciseSetType.Normal, 8, 60, 90],
    ]);
    expect(flat.sets.some((set) => set.key === 'k-new')).toBe(false);
    expect(isUniform(flat.sets)).toBe(true);
  });

  // Every set swiped away, then "Same for every set": the steppers showed
  // 0 sets, and Reps, Weight and the pad stepped nothing.
  it('gives a row with no sets left one empty set when it flattens', () => {
    const flat = flattened(draft({ perSet: true }, []), 'k-new');

    expect(flat.perSet).toBe(false);
    expect(flat.sets).toEqual([emptySet('k-new')]);
    expect(steppedAll(flat, SetFields.Reps, 1, 1).sets[0].reps).toBe(1);
  });
});

describe('saving the draft', () => {
  it('sends every set as its own row, with only what is set', () => {
    const [row] = payloadExercises([
      draft({ notes: 'Pause at the bottom' }, [
        { setType: ExerciseSetType.Warmup, reps: 10, weightKg: 20 },
        { reps: 8, repsMax: 12, weightKg: 60, restAfterSeconds: 120 },
        { durationSeconds: 30, distanceMeters: 200 },
      ]),
    ]);

    expect(row).toEqual({
      exerciseId: 'bench',
      notes: 'Pause at the bottom',
      sets: [
        { setType: ExerciseSetType.Warmup, targetRepsMin: 10, targetRepsMax: 10, targetWeightKg: 20 },
        {
          setType: ExerciseSetType.Normal,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetWeightKg: 60,
          restAfterSeconds: 120,
        },
        { setType: ExerciseSetType.Normal, targetDurationSeconds: 30, targetDistanceMeters: 200 },
      ],
    });
  });

  it('saves a routine as it was loaded, untouched', () => {
    const loaded = draftFromRoutine(
      saved({
        notes: 'Elbows in',
        supersetGroupId: null,
        sets: [plannedSet({ targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 60, restAfterSeconds: 90 })],
      }),
      'Exercise',
      keys(),
    );

    expect(payloadExercises([loaded])).toEqual([
      {
        exerciseId: 'bench',
        notes: 'Elbows in',
        sets: [
          {
            setType: ExerciseSetType.Normal,
            targetRepsMin: 8,
            targetRepsMax: 10,
            targetWeightKg: 60,
            restAfterSeconds: 90,
          },
        ],
      },
    ]);
  });

  it('keeps an exercise whose sets were all deleted, with one empty set', () => {
    expect(payloadExercises([draft({}, [])])).toEqual([{ exerciseId: 'bench', defaultSets: 1 }]);
  });

  it('numbers supersets cleanly and drops a group of one', () => {
    const out = payloadExercises([
      draft({ key: 'a', supersetGroupId: 4 }),
      draft({ key: 'b', supersetGroupId: 4 }),
      draft({ key: 'c', supersetGroupId: 7 }),
    ]);

    expect(out.map((row) => row.supersetGroupId)).toEqual([1, 1, undefined]);
  });

  it('reads two drafts that save the same as the same, whatever their keys', () => {
    const a = draftFromRoutine(saved({ sets: [plannedSet({ targetRepsMin: 8 })] }), 'Exercise', keys());
    const b = { ...a, key: 'other', addedWeight: true, sets: a.sets.map((set) => ({ ...set, key: 'x' })) };

    expect(draftSignature(' Push ', null, [a])).toBe(draftSignature('Push', null, [b]));
    expect(draftSignature('Push', null, [a])).not.toBe(draftSignature('Push', 90, [a]));
    expect(draftSignature('Push', null, [a])).not.toBe(
      draftSignature('Push', null, [{ ...a, sets: [...a.sets, emptySet('y')] }]),
    );
  });

  it('counts the routine’s note, trimmed, as part of what a save sends', () => {
    const a = draft();

    expect(draftSignature('Push', null, [a], ' Heavy first ')).toBe(
      draftSignature('Push', null, [a], 'Heavy first'),
    );
    expect(draftSignature('Push', null, [a], 'Heavy first')).not.toBe(
      draftSignature('Push', null, [a]),
    );
    expect(draftSignature('Push', null, [a], '  ')).toBe(draftSignature('Push', null, [a]));
  });
});

describe('an exercise’s ⋮', () => {
  const ids = (list: { id: string }[]) => list.map((action) => action.id);

  // The card keeps its targets, rest and Remove; the link chip sits between
  // cards. The drag mode could not be reached without dragging (WCAG 2.5.7),
  // so the moves are one tap each here (user decision, 2026-11-17).
  it('moves an exercise up or down where there is room, then swaps and reorders', () => {
    expect(ids(builderExerciseActions(1, 3))).toEqual([
      BuilderExerciseActionIds.MoveUp,
      BuilderExerciseActionIds.MoveDown,
      BuilderExerciseActionIds.Swap,
      BuilderExerciseActionIds.Reorder,
    ]);
    expect(ids(builderExerciseActions(0, 3))).toEqual([
      BuilderExerciseActionIds.MoveDown,
      BuilderExerciseActionIds.Swap,
      BuilderExerciseActionIds.Reorder,
    ]);
    expect(ids(builderExerciseActions(2, 3))).toEqual([
      BuilderExerciseActionIds.MoveUp,
      BuilderExerciseActionIds.Swap,
      BuilderExerciseActionIds.Reorder,
    ]);
  });

  it('has nothing to move or reorder with one exercise', () => {
    expect(ids(builderExerciseActions(0, 1))).toEqual([BuilderExerciseActionIds.Swap]);
  });

  // Neighbouring verbs never share a hue (lists.md), whichever rows show.
  it('keeps neighbouring tiles apart in colour', () => {
    for (const [index, count] of [[0, 3], [1, 3], [2, 3], [0, 2], [1, 2]]) {
      const colors = builderExerciseActions(index, count).map((action) => action.color);
      colors.slice(1).forEach((color, i) => expect(color).not.toBe(colors[i]));
    }
  });

  // White on sky 500 is under the 3:1 a glyph needs.
  it('draws the sky tile from its shade', () => {
    const down = builderExerciseActions(0, 2).find((a) => a.id === BuilderExerciseActionIds.MoveDown);

    expect(down).toMatchObject({ color: 'info', tone: 'shade', icon: 'chevron-down-outline' });
  });
});

describe('the builder’s ⋯', () => {
  const ids = (list: { id: string }[]) => list.map((option) => option.id);

  it('adds first, reorders once there are two, and discards once there is something to lose', () => {
    expect(ids(builderOptions(false, null))).toEqual([BuilderOptionIds.AddExercises]);
    expect(ids(builderOptions(true, 'new'))).toEqual([
      BuilderOptionIds.AddExercises,
      BuilderOptionIds.Reorder,
      BuilderOptionIds.Discard,
    ]);
  });

  it('discards a new routine, or the changes to a saved one, in red', () => {
    const discard = (kind: 'new' | 'edit') =>
      builderOptions(false, kind).find((option) => option.id === BuilderOptionIds.Discard);

    expect(discard('new')).toMatchObject({
      label: 'workouts.routineBuilder.options.discardNew',
      destructive: true,
      color: 'danger',
    });
    expect(discard('edit')?.label).toBe('workouts.routineBuilder.options.discardEdit');
  });

  // Neighbouring verbs never share a hue (lists.md).
  it('keeps add and reorder apart in colour', () => {
    const [add, reorder] = builderOptions(true, null);

    expect(add.color).not.toBe(reorder.color);
  });
});
