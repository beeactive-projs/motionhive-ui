/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { AssignedSet, ExerciseKind, ExerciseSetType, LoggedExercise, LoggedSet, RestSources, SetFields } from 'core';

import { KeypadFields } from '../workouts.config';
import {
  BadgeTones,
  KEYPAD_FIELD,
  WARMUP_REST_SECONDS,
  afterTick,
  asksEffort,
  cellValue,
  columnLabelKey,
  copiedValues,
  effortTarget,
  estimatedRest,
  exerciseBlocks,
  inSuperset,
  linkedToNext,
  memberTag,
  sameRound,
  reshapedCards,
  toggledLinks,
  withLinks,
  withoutSuperset,
  setLengthSeconds,
  tappedRest,
  focusOf,
  foldedSummary,
  isLastLeft,
  lastLine,
  loggingOrder,
  nextAfter,
  nextSetLine,
  withTicked,
  planLine,
  prefillValue,
  restAfterTick,
  setBadge,
  setLine,
  sharedColumns,
  shownValue,
} from './logger-flow';

function set(partial: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    loggedExerciseId: 'ex',
    assignedSetId: null,
    orderIndex: 0,
    setType: ExerciseSetType.Normal,
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    rir: null,
    restAfterSeconds: null,
    isCompleted: false,
    completedAt: null,
    notes: null,
    ...partial,
  };
}

function plan(partial: Partial<AssignedSet> = {}): AssignedSet {
  return {
    id: 'as',
    assignedExerciseId: 'ae',
    masterSetId: null,
    orderIndex: 0,
    setType: ExerciseSetType.Normal,
    targetRepsMin: null,
    targetRepsMax: null,
    targetWeightKg: null,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: null,
    targetRir: null,
    restAfterSeconds: null,
    tempo: null,
    notes: null,
    ...partial,
  };
}

function exercise(id: string, sets: LoggedSet[], partial: Partial<LoggedExercise> = {}): LoggedExercise {
  return {
    id,
    workoutLogId: 'log',
    exerciseId: `cat-${id}`,
    assignedExerciseId: null,
    orderIndex: 0,
    exerciseNameSnapshot: id,
    exerciseThumbnailUrlSnapshot: null,
    notes: null,
    isSkipped: false,
    swappedFromExerciseId: null,
    sets,
    ...partial,
  };
}

describe('focus order', () => {
  it('walks exercise by exercise, set by set, past skipped exercises', () => {
    const a = exercise('a', [set({ id: 'a1', isCompleted: true }), set({ id: 'a2' })]);
    const b = exercise('b', [set({ id: 'b1' })], { isSkipped: true });
    const c = exercise('c', [set({ id: 'c1' })]);
    expect(loggingOrder([a, b, c]).map((r) => r.setId)).toEqual(['a1', 'a2', 'c1']);
    expect(focusOf([a, b, c])).toEqual({ exerciseId: 'a', setId: 'a2' });
  });

  it('has no focus once everything is ticked', () => {
    expect(focusOf([exercise('a', [set({ isCompleted: true })])])).toBeNull();
  });

  it('finds the next set to do, wrapping round to one left open above', () => {
    const a = exercise('a', [set({ id: 'a1' }), set({ id: 'a2', isCompleted: true })]);
    const b = exercise('b', [set({ id: 'b1', isCompleted: true })]);
    expect(nextAfter([a, b], { exerciseId: 'b', setId: 'b1' })?.set.id).toBe('a1');
    expect(nextAfter([b], { exerciseId: 'b', setId: 'b1' })).toBeNull();
  });

  it('goes on past sets passed over, and leaves them unticked', () => {
    const a = exercise('a', [set({ id: 'a1' }), set({ id: 'a2' }), set({ id: 'a3' })]);
    const passed = new Set(['a1']);
    expect(focusOf([a], true, passed)).toEqual({ exerciseId: 'a', setId: 'a2' });
    expect(nextAfter([a], { exerciseId: 'a', setId: 'a2' }, true, passed)?.set.id).toBe('a3');
    expect(focusOf([a], true, new Set(['a1', 'a2', 'a3']))).toBeNull();
  });

  it('ticks a set in a copy, for what the lock screen shows next', () => {
    const a = exercise('a', [set({ id: 'a1' }), set({ id: 'a2' })]);
    const after = withTicked([a], 'a1');
    expect(focusOf(after)).toEqual({ exerciseId: 'a', setId: 'a2' });
    expect(a.sets?.[0].isCompleted).toBeFalsy();
  });

  // The copy carries what the ✓ logged, so the next step pre-fills from it.
  it('ticks the copy with the values the lock screen logs', () => {
    const a = exercise('a', [set({ id: 'a1' }), set({ id: 'a2' })]);
    const [ticked] = withTicked([a], 'a1', { weightKg: 60, reps: 8 });
    const first = ticked.sets?.[0];
    expect(first).toMatchObject({ isCompleted: true, weightKg: 60, reps: 8 });
    expect(prefillValue(set({ id: 'a2' }), SetFields.Weight, null, first ?? null)).toBe(60);
  });
});

describe('setBadge', () => {
  it('numbers sets without counting warm-ups, and letters typed sets', () => {
    const sets = [
      set({ setType: ExerciseSetType.Warmup }),
      set(),
      set(),
      set({ setType: ExerciseSetType.Dropset }),
    ];
    expect(setBadge(sets, 0)).toEqual({ text: 'W', tone: BadgeTones.Warmup, name: 'Warm-up' });
    expect(setBadge(sets, 1)).toEqual({ text: '1', tone: BadgeTones.Plain, name: 'Set 1' });
    expect(setBadge(sets, 2).text).toBe('2');
    expect(setBadge(sets, 3)).toEqual({ text: 'D', tone: BadgeTones.Drop, name: 'Drop set' });
  });

  // The routine builder's planned sets carry a type and their targets, no log.
  it('numbers a routine’s planned sets the same way', () => {
    const planned = [{ setType: ExerciseSetType.Warmup }, { setType: ExerciseSetType.Normal }];

    expect(setBadge(planned, 0).text).toBe('W');
    expect(setBadge(planned, 1)).toEqual({ text: '1', tone: BadgeTones.Plain, name: 'Set 1' });
  });
});

describe('the pad’s field words', () => {
  it('maps each field to its keypad, and says reps per side where they are', () => {
    expect(KEYPAD_FIELD[SetFields.Weight]).toBe(KeypadFields.Weight);
    expect(KEYPAD_FIELD[SetFields.Duration]).toBe(KeypadFields.Duration);
    expect(columnLabelKey(SetFields.Reps, false)).toBe('workouts.logger.columns.reps');
    expect(columnLabelKey(SetFields.Reps, true)).toBe('workouts.logger.columns.repsEach');
    expect(columnLabelKey(SetFields.Weight, true)).toBe('workouts.logger.columns.weight');
  });

  it('reads a planned set’s values as a logged set’s', () => {
    const planned = { reps: 8, weightKg: 60, durationSeconds: null, distanceMeters: null };
    expect(cellValue(planned, SetFields.Weight)).toBe(60);
  });
});

describe('prefillValue', () => {
  it('takes the plan first, then last time, then the set before', () => {
    const planned = set({ assignedSet: plan({ targetWeightKg: 62.5 }) });
    expect(prefillValue(planned, SetFields.Weight, set({ weightKg: 60 }), null)).toBe(62.5);
    expect(prefillValue(set(), SetFields.Weight, set({ weightKg: 60 }), set({ weightKg: 55 }))).toBe(60);
    expect(prefillValue(set(), SetFields.Weight, null, set({ weightKg: 55, isCompleted: true }))).toBe(55);
    expect(prefillValue(set(), SetFields.Weight, null, null)).toBeNull();
  });

  // Typing kg into set 1 and moving on to its reps must not fill set 2: the
  // set before lends its numbers only once it is ticked.
  it('takes nothing from the set before until it is ticked', () => {
    const typed = set({ weightKg: 55, reps: 8 });
    expect(prefillValue(set(), SetFields.Weight, null, typed)).toBeNull();
    expect(prefillValue(set(), SetFields.Reps, null, typed)).toBeNull();
    // Last time still pre-fills, ticked or not.
    expect(prefillValue(set(), SetFields.Weight, set({ weightKg: 60 }), typed)).toBe(60);
  });

  it('reads a routine target the same way as a coach plan', () => {
    const routine = set({ prescribedSet: { ...plan({ targetRepsMin: 12, targetRepsMax: 12 }), prescribedExerciseId: 'p', createdAt: '', updatedAt: '' } });
    expect(prefillValue(routine, SetFields.Reps, null, null)).toBe(12);
  });

  it('pre-fills a rep range with last time when inside it, else its bottom', () => {
    const ranged = set({ assignedSet: plan({ targetRepsMin: 8, targetRepsMax: 10 }) });
    expect(prefillValue(ranged, SetFields.Reps, set({ reps: 9 }), null)).toBe(9);
    expect(prefillValue(ranged, SetFields.Reps, set({ reps: 12 }), null)).toBe(8);
    expect(prefillValue(ranged, SetFields.Reps, null, null)).toBe(8);
  });

  it('uses the %1RM resolved to kilograms', () => {
    const resolved = set({ assignedSet: plan({ targetWeightKg: null, resolvedWeightKg: 70 }) });
    expect(prefillValue(resolved, SetFields.Weight, null, null)).toBe(70);
  });
});

describe('set lines', () => {
  const kgReps = [SetFields.Weight, SetFields.Reps];
  it('writes weight and reps, reps alone, and holds', () => {
    expect(setLine(kgReps, (f) => (f === SetFields.Weight ? 62.5 : 8), true)).toBe('62.5 kg × 8');
    expect(setLine([SetFields.Reps], () => 15, true)).toBe('× 15');
    expect(setLine([SetFields.Duration], () => 90, true)).toBe('1:30');
    expect(setLine(kgReps, () => null, true)).toBe('');
  });

  it('says what the same set did last time', () => {
    expect(lastLine(kgReps, set({ weightKg: 60, reps: 8 }))).toBe('last 60 × 8');
    expect(lastLine(kgReps, null)).toBe('');
  });

  it('shows what was typed, else the pre-fill, else nothing', () => {
    const row = { set: set({ reps: 10 }), prefill: { [SetFields.Weight]: 62.5, [SetFields.Reps]: 8 } };
    expect(shownValue(row, SetFields.Reps)).toBe(10);
    expect(shownValue(row, SetFields.Weight)).toBe(62.5);
    expect(shownValue(row, SetFields.Duration)).toBeNull();
    expect(shownValue({ ...row, prefill: { [SetFields.Weight]: null } }, SetFields.Weight)).toBeNull();
  });

  // A plan day's unticked set shows the plan's 60 × 8 in grey; its copy has no
  // plan, so it has to carry those numbers itself or it shows "– –".
  it('copies the numbers a set shows, typed or grey', () => {
    const kgReps = [SetFields.Weight, SetFields.Reps];
    const grey = { set: set(), prefill: { [SetFields.Weight]: 60, [SetFields.Reps]: 8 } };
    expect(copiedValues(grey, kgReps)).toEqual({ weightKg: 60, reps: 8 });

    const typed = { set: set({ reps: 10 }), prefill: { [SetFields.Weight]: 60, [SetFields.Reps]: 8 } };
    expect(copiedValues(typed, kgReps)).toEqual({ weightKg: 60, reps: 10 });
  });

  it('copies only the fields the exercise records, and leaves empty ones out', () => {
    const row = { set: set({ weightKg: 20, durationSeconds: 45 }), prefill: {} };
    expect(copiedValues(row, [SetFields.Duration])).toEqual({ durationSeconds: 45 });
    expect(copiedValues({ set: set(), prefill: { [SetFields.Reps]: null } }, [SetFields.Reps])).toEqual({});
  });

  it('writes the next set in one line, with Last set on an exercise\'s last', () => {
    expect(nextSetLine('Set 3', '62.5 kg × 8', 'Bench press', 'Last set')).toBe(
      'Set 3 · 62.5 kg × 8 · Bench press · Last set',
    );
    expect(nextSetLine('Set 1', '', 'Push-ups', '')).toBe('Set 1 · Push-ups');
    expect(isLastLeft([set({ isCompleted: true }), set()])).toBe(true);
    expect(isLastLeft([set(), set()])).toBe(false);
    expect(isLastLeft([set({ isCompleted: true })])).toBe(false);
  });
});

describe('restAfterTick', () => {
  it('rests the plan, else the person default, else 90 s', () => {
    expect(restAfterTick(set({ plannedRestSeconds: 120 }), set())).toBe(120);
    expect(restAfterTick(set({ assignedSet: plan({ restAfterSeconds: 150 }) }), set())).toBe(150);
    expect(restAfterTick(set(), set(), { personDefault: 75 })).toBe(75);
    expect(restAfterTick(set(), set())).toBe(90);
  });

  it('lets "this exercise" beat the plan and "every exercise" fill only the gaps', () => {
    const planned = set({ plannedRestSeconds: 120 });
    expect(restAfterTick(planned, set(), { exerciseOverride: 60, workoutDefault: 45 })).toBe(60);
    expect(restAfterTick(planned, set(), { workoutDefault: 45 })).toBe(120);
    expect(restAfterTick(set(), set(), { workoutDefault: 45, personDefault: 75 })).toBe(45);
  });

  it('gives a warm-up 45 s unless it has its own rest', () => {
    expect(restAfterTick(set({ setType: ExerciseSetType.Warmup }), set(), { exerciseOverride: 180 })).toBe(WARMUP_REST_SECONDS);
    expect(restAfterTick(set({ setType: ExerciseSetType.Warmup, plannedRestSeconds: 30 }), set())).toBe(30);
  });

  it('does not rest before a drop set, or after the last set', () => {
    expect(restAfterTick(set(), set({ setType: ExerciseSetType.Dropset }))).toBeNull();
    expect(restAfterTick(set(), null)).toBeNull();
  });

  it('rests after a tick by the set after it, and says when nothing is left', () => {
    const a1 = set({ id: 'a1', plannedRestSeconds: 120 });
    const list = [exercise('a', [a1, set({ id: 'a2' })])];
    const ref = { exerciseId: 'a', setId: 'a1' };
    expect(afterTick(list, ref, a1, true, new Set(), {})).toEqual({ rest: 120, final: false });
    expect(afterTick(list, ref, a1, true, new Set(['a2']), {})).toEqual({ rest: null, final: true });
    expect(afterTick(list, ref, set({ id: 'a1' }), true, new Set(), { personDefault: 75 })).toEqual({
      rest: 75,
      final: false,
    });
  });
});

describe('measured rest', () => {
  it('takes about 3 s a rep off the gap, between 20 and 90 s, or a timed set\'s time', () => {
    expect(setLengthSeconds(set({ reps: 8 }))).toBe(24);
    expect(setLengthSeconds(set({ reps: 3 }))).toBe(20);
    expect(setLengthSeconds(set({ reps: 50 }))).toBe(90);
    expect(setLengthSeconds(set({ durationSeconds: 45 }))).toBe(45);
  });

  it('estimates the rest from the gap between ticks', () => {
    expect(estimatedRest(184, 120, set({ reps: 8 }))).toEqual({ seconds: 160, source: RestSources.Estimated });
    expect(estimatedRest(26, 120, set({ reps: 8 }))).toBeNull();
  });

  it('calls a long gap a break and stores no time', () => {
    expect(estimatedRest(25 * 60, 120, set())).toEqual({ seconds: null, source: RestSources.Break });
    expect(estimatedRest(9 * 60, 240, set({ reps: 8 }))).toEqual({ seconds: 516, source: RestSources.Estimated });
  });

  it('keeps a tapped rest exact', () => {
    expect(tappedRest(150.4)).toEqual({ seconds: 150, source: RestSources.Tap });
  });
});

describe('effort', () => {
  it('asks when switched on, or when the plan sets a target, never for a warm-up', () => {
    expect(asksEffort(set(), false)).toBe(false);
    expect(asksEffort(set(), true)).toBe(true);
    expect(asksEffort(set({ assignedSet: plan({ targetRpe: 8 }) }), false)).toBe(true);
    expect(asksEffort(set({ setType: ExerciseSetType.Warmup }), true)).toBe(false);
  });

  it('reads reps in reserve as RPE', () => {
    expect(effortTarget(set({ assignedSet: plan({ targetRir: 2 }) }))).toBe(8);
    expect(effortTarget(set())).toBeNull();
  });
});

describe('summaries', () => {
  it('folds a finished exercise to its count and best working set', () => {
    const ex = exercise('bench', [
      set({ setType: ExerciseSetType.Warmup, weightKg: 100, reps: 10, isCompleted: true }),
      set({ weightKg: 62.5, reps: 8, isCompleted: true }),
      set({ weightKg: 65, reps: 8, isCompleted: true }),
    ]);
    expect(foldedSummary(ex, ExerciseKind.Strength)).toBe('3 sets · best 65 × 8');
    const pushups = exercise('push', [set({ reps: 15, isCompleted: true }), set({ reps: 12, isCompleted: true })]);
    expect(foldedSummary(pushups, ExerciseKind.Bodyweight)).toBe('2 sets · best × 15');
  });

  // Every exercise folds, finished or not (2026-11-18).
  it('folds an exercise still being worked to how far along it is', () => {
    const ex = exercise('bench', [
      set({ weightKg: 60, reps: 8, isCompleted: true }),
      set({ weightKg: 62.5, reps: 8 }),
      set({ weightKg: 62.5, reps: 8 }),
    ]);
    expect(foldedSummary(ex, ExerciseKind.Strength)).toBe('1 of 3 sets · best 60 × 8');
    expect(foldedSummary(exercise('row', [set(), set()]), ExerciseKind.Strength)).toBe('0 of 2 sets');
  });

  it('writes the plan line from the working sets', () => {
    const planned = (extra: Partial<AssignedSet> = {}) =>
      set({ assignedSet: plan({ targetRepsMin: 8, targetRepsMax: 10, targetRpe: 8, targetWeightKg: 62.5, restAfterSeconds: 120, ...extra }) });
    const ex = exercise('bench', [set({ setType: ExerciseSetType.Warmup }), planned(), planned(), planned()]);
    expect(planLine(ex)).toBe('3 × 8–10 · effort 8 · 62.5 kg · rest 2:00');
    expect(planLine(exercise('free', [set()]))).toBe('');
  });
});

describe('supersets', () => {
  const ids = (refs: { setId: string }[]) => refs.map((r) => r.setId);
  const a = () => exercise('a', [set({ id: 'a1' }), set({ id: 'a2' }), set({ id: 'a3' })], { supersetGroupId: 1 });
  const b = () => exercise('b', [set({ id: 'b1' }), set({ id: 'b2' })], { supersetGroupId: 1 });
  const c = () => exercise('c', [set({ id: 'c1' })]);

  it('letters consecutive linked exercises and tags their members', () => {
    const blocks = exerciseBlocks([a(), b(), c()]);
    expect(blocks.map((bl) => bl.letter)).toEqual(['A', null]);
    expect(memberTag(blocks[0], 'b')).toBe('A2');
    expect(memberTag(blocks[1], 'c')).toBeNull();
  });

  it('does not treat a group of one as a superset', () => {
    expect(exerciseBlocks([a(), c()]).map((bl) => bl.letter)).toEqual([null, null]);
  });

  it('goes round by round, and the longer member carries on alone', () => {
    expect(ids(loggingOrder([a(), b(), c()]))).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'c1']);
  });

  it('goes exercise by exercise when jumping within a superset is off', () => {
    expect(ids(loggingOrder([a(), b()], false))).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
  });

  it('leaves a skipped half out', () => {
    expect(ids(loggingOrder([a(), { ...b(), isSkipped: true }]))).toEqual(['a1', 'a2', 'a3']);
  });

  it('rests only after the round', () => {
    const list = [a(), b()];
    expect(sameRound(list, { exerciseId: 'a', setId: 'a1' }, { exerciseId: 'b', setId: 'b1' })).toBe(true);
    expect(sameRound(list, { exerciseId: 'b', setId: 'b1' }, { exerciseId: 'a', setId: 'a2' })).toBe(false);
    expect(sameRound(list, { exerciseId: 'a', setId: 'a1' }, { exerciseId: 'b', setId: 'b1' }, false)).toBe(false);
    expect(restAfterTick(set(), set(), { sameRound: true })).toBeNull();
    const first = set({ id: 'a1' });
    const round = [exercise('a', [first, set({ id: 'a2' })], { supersetGroupId: 1 }), b()];
    const ref = { exerciseId: 'a', setId: 'a1' };
    expect(afterTick(round, ref, first, true, new Set(), {})).toEqual({ rest: null, final: false });
    expect(afterTick(round, ref, first, false, new Set(), {})).toEqual({ rest: 90, final: false });
  });

  it('badges a member set with its tag', () => {
    expect(setBadge([set(), set()], 1, { tag: 'A2', name: 'Push-ups' })).toEqual({
      text: 'A2',
      tone: BadgeTones.Plain,
      name: 'Push-ups',
      short: 'Round 2',
    });
  });
});

// One heading over a superset's rounds, as over an exercise's sets (2026-11-18).
describe('sharedColumns', () => {
  const lifted = { fields: [SetFields.Weight, SetFields.Reps], unilateral: false };

  it('gives the members’ columns when they all record the same fields', () => {
    expect(sharedColumns([lifted, { ...lifted, fields: [SetFields.Weight, SetFields.Reps] }])).toEqual(lifted);
  });

  it('gives none when a member records other fields, or the same in another order', () => {
    expect(sharedColumns([lifted, { fields: [SetFields.Duration], unilateral: false }])).toBeNull();
    expect(sharedColumns([lifted, { fields: [SetFields.Reps], unilateral: false }])).toBeNull();
    expect(
      sharedColumns([lifted, { fields: [SetFields.Reps, SetFields.Weight], unilateral: false }]),
    ).toBeNull();
  });

  // "Reps each" over a lunge would be wrong for the push-up beside it.
  it('gives none when only some members count reps per side', () => {
    expect(sharedColumns([lifted, { ...lifted, unilateral: true }])).toBeNull();
    expect(sharedColumns([{ ...lifted, unilateral: true }, { ...lifted, unilateral: true }])).toEqual({
      ...lifted,
      unilateral: true,
    });
  });

  it('gives none with nobody in play', () => {
    expect(sharedColumns([])).toBeNull();
  });
});

// The link chip between two cards, as the routine builder has (2026-11-18).
describe('superset links', () => {
  const ex = (id: string, group: number | null = null) => exercise(id, [set()], { supersetGroupId: group });

  it('reads which exercises are linked', () => {
    const list = [ex('a', 1), ex('b', 1), ex('c')];
    expect(linkedToNext(list, 0)).toBe(true);
    expect(linkedToNext(list, 1)).toBe(false);
    expect([0, 1, 2].map((i) => inSuperset(list, i))).toEqual([true, true, false]);
  });

  it('links two exercises, sending only the ones that changed', () => {
    expect(toggledLinks([ex('a'), ex('b'), ex('c')], 1)).toEqual([
      { id: 'b', supersetGroupId: 1 },
      { id: 'c', supersetGroupId: 1 },
    ]);
  });

  it('adds an exercise to the superset beside it, and merges two', () => {
    expect(toggledLinks([ex('a', 1), ex('b', 1), ex('c')], 1)).toEqual([{ id: 'c', supersetGroupId: 1 }]);
    expect(toggledLinks([ex('a', 1), ex('b', 1), ex('c', 2), ex('d', 2)], 1)).toEqual([
      { id: 'c', supersetGroupId: 1 },
      { id: 'd', supersetGroupId: 1 },
    ]);
  });

  it('undoes a link, and a superset left with one exercise is none', () => {
    expect(toggledLinks([ex('a', 1), ex('b', 1)], 0)).toEqual([
      { id: 'a', supersetGroupId: null },
      { id: 'b', supersetGroupId: null },
    ]);
  });

  it('takes an exercise out of its superset, keeping the rest linked', () => {
    const four = [ex('a', 1), ex('b', 1), ex('c', 1), ex('d', 1)];
    expect(withoutSuperset(four, 0)).toEqual([{ id: 'a', supersetGroupId: null }]);
    expect(withoutSuperset(four, 3)).toEqual([{ id: 'd', supersetGroupId: null }]);
    // From the middle: what is left on either side stays only if it is two or more.
    expect(withoutSuperset(four, 1)).toEqual([
      { id: 'a', supersetGroupId: null },
      { id: 'b', supersetGroupId: null },
    ]);
    expect(withoutSuperset([ex('a', 1), ex('b', 1), ex('c', 1)], 1)).toEqual([
      { id: 'a', supersetGroupId: null },
      { id: 'b', supersetGroupId: null },
      { id: 'c', supersetGroupId: null },
    ]);
  });

  it('puts the changed groups into the workout, leaving the rest as they were', () => {
    const list = [ex('a'), ex('b'), ex('c', 1)];
    const linked = withLinks(list, [
      { id: 'a', supersetGroupId: 2 },
      { id: 'b', supersetGroupId: 2 },
    ]);

    expect(linked.map((e) => e.supersetGroupId)).toEqual([2, 2, 1]);
    expect(linked[2]).toBe(list[2]);
  });
});

// Which cards a link reshapes: a hand fold on any of them goes back to the default.
describe('reshapedCards', () => {
  const ex = (id: string, group: number | null = null) => exercise(id, [set()], { supersetGroupId: group });
  const reshaped = (
    before: LoggedExercise[],
    changes: { id: string; supersetGroupId: number | null }[],
    rounds = true,
  ) => [...reshapedCards(before, withLinks(before, changes), rounds)].sort();

  it('names the card that joins, and the superset it joins', () => {
    // a joins b + c at the front, so the superset's key moves from b to a.
    const list = [ex('a'), ex('b', 1), ex('c', 1)];
    expect(reshaped(list, [{ id: 'a', supersetGroupId: 1 }])).toEqual(['a', 'b']);
  });

  it('names a superset that gains a member at its end', () => {
    const list = [ex('b', 1), ex('c', 1), ex('d')];
    expect(reshaped(list, [{ id: 'd', supersetGroupId: 1 }])).toEqual(['b', 'd']);
  });

  // Linking p and q renumbers the superset under them; its card is the same one.
  it('leaves out a superset the change only renumbers', () => {
    const list = [ex('p'), ex('q'), ex('b', 1), ex('c', 1)];
    const changes = toggledLinks(list, 0);
    expect(changes.map((c) => c.id)).toEqual(['p', 'q', 'b', 'c']);
    expect(reshaped(list, changes)).toEqual(['p', 'q']);
  });

  it('names none while every exercise is a card of its own', () => {
    const list = [ex('a'), ex('b', 1), ex('c', 1)];
    expect(reshaped(list, [{ id: 'a', supersetGroupId: 1 }], false)).toEqual([]);
  });
});
