import { describe, expect, it } from 'vitest';

import { WorkoutLog } from 'core';

import { HexMeterPhases } from '../_components/hex-meter/hex-meter';
import { ActiveRest, ActiveSession, LiveNext } from './active-session.store';
import {
  ACTIVE_STATUS_ICONS,
  activeStatus,
  freshestClock,
  nextWords,
  statusWords,
} from './active-status.config';

const NOW = Date.parse('2026-11-19T10:00:00Z');

const session: ActiveSession = {
  id: 'wl-1',
  name: 'Leg day',
  startedAt: '2026-11-19T09:00:00Z',
  pausedAt: null,
  pausedSeconds: 0,
};

/** A 90 s rest after a set of `logId`, ending `endsIn` seconds from now. */
function rest(endsIn: number, logId = 'wl-1'): ActiveRest {
  return {
    logId,
    exerciseId: 'e-1',
    setId: 's-3',
    startedAt: NOW - (90 - endsIn) * 1000,
    endsAt: NOW + endsIn * 1000,
    planned: 90,
    next: 'Set 4 · 90 kg × 5 · Squat',
  };
}

describe('activeStatus', () => {
  it('is a barbell on a plain ring between sets', () => {
    expect(activeStatus(session, null, NOW)).toEqual({
      phase: HexMeterPhases.Workout,
      icon: 'barbell-outline',
      rest: null,
      share: 0,
      restClock: '',
    });
  });

  it('drains the ring and counts down while a rest runs', () => {
    const status = activeStatus(session, rest(45), NOW);
    expect(status.phase).toBe(HexMeterPhases.Rest);
    expect(status.icon).toBe('timer-outline');
    expect(status.share).toBe(0.5);
    expect(status.restClock).toBe('0:45');
    expect(status.rest?.next).toBe('Set 4 · 90 kg × 5 · Squat');
  });

  // +15 s three times on a 90 s rest: 2:15 of 2:15, draining from full at
  // once, as the rest bar and the lock screen show it, not "2:15 of 1:30".
  it('measures a nudged rest from its start to its new end', () => {
    const nudged = { ...rest(90), endsAt: NOW + 135 * 1000 };
    const status = activeStatus(session, nudged, NOW);
    expect(status.rest?.planned).toBe(135);
    expect(status.share).toBe(1);
    expect(activeStatus(session, nudged, NOW + 45 * 1000).share).toBeCloseTo(90 / 135);

    const shortened = { ...rest(90), endsAt: NOW + 45 * 1000 };
    expect(activeStatus(session, shortened, NOW).rest?.planned).toBe(45);
    expect(activeStatus(session, shortened, NOW).share).toBe(1);
  });

  it('ticks once the rest is over, and counts the overtime', () => {
    const status = activeStatus(session, rest(-53), NOW);
    expect(status.phase).toBe(HexMeterPhases.Over);
    expect(status.share).toBe(0);
    expect(status.restClock).toBe('+0:53');
  });

  it('lets a rest go ten minutes over, then goes back to the workout', () => {
    expect(activeStatus(session, rest(-600), NOW).phase).toBe(HexMeterPhases.Over);
    expect(activeStatus(session, rest(-601), NOW).phase).toBe(HexMeterPhases.Workout);
  });

  it('ignores a rest kept for another workout, or one whose bar was hidden', () => {
    expect(activeStatus(session, rest(45, 'wl-old'), NOW).phase).toBe(HexMeterPhases.Workout);
    expect(activeStatus(session, { ...rest(45), endsAt: null }, NOW).phase).toBe(
      HexMeterPhases.Workout,
    );
  });

  // The lock screen says the same (`liveState`): a paused workout has no rest.
  it('is paused, with no rest, once the clock stopped', () => {
    const paused = { ...session, pausedAt: '2026-11-19T09:59:00Z' };
    expect(activeStatus(paused, rest(45), NOW)).toEqual({
      phase: HexMeterPhases.Paused,
      icon: 'pause-outline',
      rest: null,
      share: 0,
      restClock: '',
    });
  });

  it('is a plain workout with nothing open', () => {
    expect(activeStatus(null, rest(45), NOW).phase).toBe(HexMeterPhases.Workout);
    expect(activeStatus(null, null, NOW, true).phase).toBe(HexMeterPhases.Workout);
  });

  it('shows the trophy on a full ring once every set is ticked', () => {
    expect(activeStatus(session, null, NOW, true)).toEqual({
      phase: HexMeterPhases.Done,
      icon: 'trophy-outline',
      rest: null,
      share: 0,
      restClock: '',
    });
  });

  it('lets a rest still counting, or a pause, go before all done', () => {
    expect(activeStatus(session, rest(45), NOW, true).phase).toBe(HexMeterPhases.Rest);
    const paused = { ...session, pausedAt: '2026-11-19T09:59:00Z' };
    expect(activeStatus(paused, null, NOW, true).phase).toBe(HexMeterPhases.Paused);
  });

  // An unregistered glyph draws as a blank ring with no error, and the
  // mini-bar shows on tabs where the Workouts page never registered its own.
  it('only puts glyphs in the ring that its surfaces register', () => {
    const registered = Object.keys(ACTIVE_STATUS_ICONS).map((key) =>
      key.replace(/([A-Z])/g, '-$1').toLowerCase(),
    );
    const paused = { ...session, pausedAt: '2026-11-19T09:59:00Z' };
    const everyPhase = [
      activeStatus(session, null, NOW),
      activeStatus(session, rest(45), NOW),
      activeStatus(session, rest(-25), NOW),
      activeStatus(paused, null, NOW),
      activeStatus(session, null, NOW, true),
    ];
    expect(new Set(everyPhase.map((status) => status.phase)).size).toBe(
      Object.keys(HexMeterPhases).length,
    );
    for (const status of everyPhase) {
      expect(registered, `${status.icon} is shown but not registered`).toContain(status.icon);
    }
  });
});

/**
 * The resume card's line and the mini-bar's spoken name read these words,
 * so the two say the same thing about the same moment.
 */
describe('statusWords', () => {
  const at = (r: ActiveRest | null, s: ActiveSession = session, allDone = false) =>
    activeStatus(s, r, NOW, allDone);

  it('says the workout clock between sets, with the set count once known', () => {
    expect(statusWords(at(null), '1:00:00')).toEqual({
      key: 'workouts.home.workout',
      params: { elapsed: '1:00:00' },
    });
    expect(statusWords(at(null), '1:00:00', { done: 7, total: 13 })).toEqual({
      key: 'workouts.home.workoutSets',
      params: { elapsed: '1:00:00', done: 7, total: 13 },
    });
    // No sets to count is no count.
    expect(statusWords(at(null), '1:00:00', { done: 0, total: 0 }).key).toBe(
      'workouts.home.workout',
    );
  });

  it('counts the rest down against what was planned', () => {
    expect(statusWords(at(rest(62)), '1:00:00')).toEqual({
      key: 'workouts.home.resting',
      params: { left: '1:02', planned: '1:30' },
    });
  });

  it('says only "Rest over" in the first second, then by how much', () => {
    expect(statusWords(at(rest(-0.5)), '1:00:00')).toEqual({
      key: 'workouts.home.restOver',
      params: {},
    });
    expect(statusWords(at(rest(-25)), '1:00:00')).toEqual({
      key: 'workouts.home.restOvertime',
      params: { over: '+0:25' },
    });
  });

  it('says paused and all done with the clock', () => {
    const paused = { ...session, pausedAt: '2026-11-19T09:50:00Z' };
    expect(statusWords(at(null, paused), '50:00')).toEqual({
      key: 'workouts.home.paused',
      params: { elapsed: '50:00' },
    });
    expect(statusWords(at(null, session, true), '1:00:00')).toEqual({
      key: 'workouts.home.allDone',
      params: { elapsed: '1:00:00' },
    });
  });
});

describe('nextWords', () => {
  const step = { exercise: 'Bench press', set: 'Set 3', total: 4 } as LiveNext;

  it('names the exercise and the set', () => {
    expect(nextWords(step, 'whole line')).toEqual({
      key: 'workouts.activeBar.nextSet',
      params: { exercise: 'Bench press', set: 'Set 3' },
    });
  });

  it('names the round in a superset', () => {
    expect(nextWords({ ...step, set: 'Round 2', total: 3, round: 2 }, '')).toEqual({
      key: 'workouts.activeBar.nextRound',
      params: { round: 2, total: 3 },
    });
  });

  it('falls back on the whole line, then on nothing', () => {
    expect(nextWords(null, 'Set 3 · 62.5 kg × 8 · Bench press')).toEqual({
      key: 'workouts.live.next',
      params: { next: 'Set 3 · 62.5 kg × 8 · Bench press' },
    });
    expect(nextWords(null, '')).toBeNull();
  });
});

describe('freshestClock', () => {
  const log = { ...session, pausedAt: '2026-11-19T09:59:00Z' } as unknown as WorkoutLog;

  // The API answered before the resume reached it; the logger already resumed.
  it('takes the store’s copy of the same workout over the API’s', () => {
    expect(freshestClock(log, session)).toBe(session);
  });

  it('takes the API’s while the store holds another workout or none', () => {
    expect(freshestClock(log, { ...session, id: 'wl-other' })).toBe(log);
    expect(freshestClock(log, null)).toBe(log);
  });

  it('is nothing with no workout open', () => {
    expect(freshestClock(null, session)).toBeNull();
  });
});
