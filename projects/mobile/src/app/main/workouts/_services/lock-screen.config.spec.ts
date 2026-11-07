import { describe, expect, it } from 'vitest';

import { ActiveRest, ActiveSession, LiveNext } from './active-session.store';
import { liveState, Translate } from './lock-screen.config';

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
    const live: LiveNext = {
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
    };
    const state = liveState(session, rest, '', translate, NOW, live);
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
  });
});
