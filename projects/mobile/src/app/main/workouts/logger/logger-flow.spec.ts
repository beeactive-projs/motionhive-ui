/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { AssignedSet, ExerciseKind, ExerciseSetType, LoggedExercise, LoggedSet, RestSources, SetFields } from 'core';

import {
  BadgeTones,
  WARMUP_REST_SECONDS,
  asksEffort,
  effortTarget,
  estimatedRest,
  exerciseBlocks,
  memberTag,
  sameRound,
  setLengthSeconds,
  tappedRest,
  focusOf,
  foldedSummary,
  lastLine,
  loggingOrder,
  nextAfter,
  withTicked,
  planLine,
  prefillValue,
  restAfterTick,
  setBadge,
  setLine,
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
});

describe('prefillValue', () => {
  it('takes the plan first, then last time, then the set before', () => {
    const planned = set({ assignedSet: plan({ targetWeightKg: 62.5 }) });
    expect(prefillValue(planned, SetFields.Weight, set({ weightKg: 60 }), null)).toBe(62.5);
    expect(prefillValue(set(), SetFields.Weight, set({ weightKg: 60 }), set({ weightKg: 55 }))).toBe(60);
    expect(prefillValue(set(), SetFields.Weight, null, set({ weightKg: 55 }))).toBe(55);
    expect(prefillValue(set(), SetFields.Weight, null, null)).toBeNull();
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
