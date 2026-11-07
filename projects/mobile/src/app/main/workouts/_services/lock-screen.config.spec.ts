import { describe, expect, it } from 'vitest';

import { RestLiveActionTypes } from '../../../_shared/native/rest-live';
import { ActiveRest, ActiveSession, LiveStep } from './active-session.store';
import {
  isNextStep,
  liveState,
  liveTickRest,
  liveValues,
  STEPS_BUDGET_BYTES,
  Translate,
} from './lock-screen.config';

const START = Date.parse('2026-11-02T17:00:00Z');
const NOW = START + 20 * 60_000;

const session: ActiveSession = {
  id: 'log-1',
  name: 'Push day',
  startedAt: new Date(START).toISOString(),
  pausedAt: null,
  pausedSeconds: 90,
};

const rest: ActiveRest = {
  logId: 'log-1',
  exerciseId: 'ex-1',
  setId: 'set-2',
  startedAt: NOW - 30_000,
  endsAt: NOW + 60_000,
  planned: 90,
  next: 'Set 3 · 62.5 kg × 8 · Bench press',
};

const bench: LiveStep = {
  exercise: 'Bench press',
  set: 'Set 3',
  target: '62.5 kg × 8',
  last: 'last 60 × 8',
  done: 2,
  total: 4,
  workoutDone: 7,
  workoutTotal: 13,
  kicker: '',
  order: '',
  exerciseId: 'ex-1',
  setId: 'set-3',
  values: { weightKg: 62.5, reps: 8 },
  short: '62.5 × 8',
  rest: 90,
  line: 'Set 3 · 62.5 kg × 8 · Bench press',
  final: false,
};

/** The key, with its params, so the test reads what was asked for. */
const translate: Translate = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

describe('liveState', () => {
  it('shows a running rest with what comes next', () => {
    const state = liveState(session, rest, 'ignored', translate, NOW);
    expect(state.restStartedAt).toBe(rest.startedAt);
    expect(state.restEndsAt).toBe(rest.endsAt);
    expect(state.restLine).toBe('workouts.activeBar.resting {"next":"Set 3 · 62.5 kg × 8 · Bench press"}');
    expect(state.goLine).toBe('Set 3 · 62.5 kg × 8 · Bench press');
    expect(state.labels.plus).toBe('workouts.live.plus {"seconds":15}');
  });

  it('counts the workout from its start, moved on by the time it was paused', () => {
    const state = liveState(session, null, 'Set 1 · Squat', translate, NOW);
    expect(state.clockFrom).toBe(START + 90_000);
    expect(state.pausedSeconds).toBeNull();
    expect(state.restEndsAt).toBeNull();
    expect(state.workoutLine).toBe('workouts.live.next {"next":"Set 1 · Squat"}');
  });

  it('holds a paused clock still and shows no rest', () => {
    const paused = { ...session, pausedAt: new Date(START + 10 * 60_000).toISOString() };
    const state = liveState(paused, rest, '', translate, NOW);
    expect(state.clockFrom).toBeNull();
    expect(state.pausedSeconds).toBe(10 * 60 - 90);
    expect(state.restEndsAt).toBeNull();
  });

  it('drops a rest ten minutes over, a hidden rest, and another workout’s rest', () => {
    const over = liveState(session, { ...rest, endsAt: NOW - 10 * 60_000 - 1 }, '', translate, NOW);
    const hidden = liveState(session, { ...rest, endsAt: null }, '', translate, NOW);
    const other = liveState(session, { ...rest, logId: 'log-2' }, '', translate, NOW);
    expect([over.restEndsAt, hidden.restEndsAt, other.restEndsAt]).toEqual([null, null, null]);
  });

  it('says Rest alone when nothing comes next', () => {
    const state = liveState(session, { ...rest, next: '' }, '', translate, NOW);
    expect(state.restLine).toBe('workouts.restTimer.rest');
    expect(state.goLine).toBe('workouts.restTimer.restOver');
    expect(state.workoutLine).toBe('');
  });

  it('sends the next set in pieces, with the rest as planned', () => {
    const state = liveState(session, rest, '', translate, NOW, [bench]);
    expect(state.exercise).toBe('Bench press');
    expect(state.set).toBe('Set 3');
    expect(state.aim).toBe('workouts.live.target {"value":"62.5 kg × 8"}');
    expect(state.progress).toBe('workouts.live.progress {"done":7,"total":13}');
    expect(state.planned).toBe('workouts.live.planned {"total":"1:30"}');
    expect([state.done, state.total]).toEqual([2, 4]);
  });

  it('leaves the pieces empty when the logger has not said, and the plan out between sets', () => {
    const state = liveState(session, null, 'Set 1 · Squat', translate, NOW);
    expect([state.exercise, state.aim, state.progress, state.planned]).toEqual(['', '', '', '']);
    expect([state.done, state.total]).toEqual([0, 0]);
    expect(state.steps).toEqual([]);
  });

  it('sends the sets ahead, with what ✓ saves and the rest after each', () => {
    const next: LiveStep = { ...bench, setId: 'set-4', set: 'Set 4', done: 3, workoutDone: 8, final: true, rest: null };
    const state = liveState(session, null, '', translate, NOW, [bench, next]);
    expect(state.steps.map((step) => step.setId)).toEqual(['set-3', 'set-4']);
    expect(state.steps[0]).toMatchObject({
      exerciseId: 'ex-1',
      values: { weightKg: 62.5, reps: 8 },
      rest: 90,
      line: 'Set 3 · 62.5 kg × 8 · Bench press',
      final: false,
      aim: 'workouts.live.target {"value":"62.5 kg × 8"}',
    });
    expect(state.steps[1]).toMatchObject({ set: 'Set 4', rest: null, final: true });
    expect(state.labels.skipSet).toBe('workouts.live.skipSet');
    expect(state.labels.resume).toBe('button.continue');
  });

  it('leaves out the sets ahead that would make the Live Activity too big, never the next one', () => {
    const long = 'Î'.repeat(400);
    const steps = [0, 1, 2].map((n) => ({ ...bench, setId: `set-${n}`, order: long }));
    const state = liveState(session, null, '', translate, NOW, steps);
    expect(state.steps.length).toBeGreaterThanOrEqual(1);
    expect(state.steps.length).toBeLessThan(3);
    expect(new TextEncoder().encode(JSON.stringify(state.steps)).length).toBeLessThanOrEqual(
      Math.max(STEPS_BUDGET_BYTES, new TextEncoder().encode(JSON.stringify(state.steps.slice(0, 1))).length),
    );
  });
});

describe('liveValues', () => {
  it('keeps the values the API takes and drops anything else', () => {
    expect(liveValues({ weightKg: 62.5, reps: 8, rpe: 9, durationSeconds: -1, distanceMeters: 'far' })).toEqual({
      weightKg: 62.5,
      reps: 8,
    });
    expect(liveValues(undefined)).toEqual({});
  });
});

describe('isNextStep', () => {
  it('takes a ✓ for the set shown next, and none for a set already moved past', () => {
    const after: LiveStep = { ...bench, setId: 'set-4' };
    expect(isNextStep([bench, after], 'set-3')).toBe(true);
    expect(isNextStep([after], 'set-3')).toBe(false);
  });

  it('takes it when no sets ahead were kept: nothing tells them apart', () => {
    expect(isNextStep([], 'set-3')).toBe(true);
  });
});

describe('liveTickRest', () => {
  const tick = {
    type: RestLiveActionTypes.Log,
    at: NOW,
    setId: 'set-3',
    exerciseId: 'ex-1',
    endsAt: NOW + 120_000,
  };

  it('runs the step’s own rest from the tap', () => {
    expect(liveTickRest('log-1', tick, bench, 'Set 4 · Bench press')).toEqual({
      logId: 'log-1',
      exerciseId: 'ex-1',
      setId: 'set-3',
      startedAt: NOW,
      endsAt: NOW + 90_000,
      planned: 90,
      next: 'Set 4 · Bench press',
    });
  });

  it('starts none after a step that has no rest', () => {
    expect(liveTickRest('log-1', tick, { ...bench, rest: null }, '')).toBeNull();
  });

  it('keeps the rest the lock screen started when the app no longer knows the step', () => {
    expect(liveTickRest('log-1', tick, null, '')).toEqual({
      logId: 'log-1',
      exerciseId: 'ex-1',
      setId: 'set-3',
      startedAt: NOW,
      endsAt: NOW + 120_000,
      planned: 120,
      next: '',
    });
  });

  it('starts none when neither the step nor the note says one started', () => {
    expect(liveTickRest('log-1', { ...tick, endsAt: undefined }, null, '')).toBeNull();
    expect(liveTickRest('log-1', { ...tick, setId: undefined }, bench, '')).toBeNull();
  });
});
