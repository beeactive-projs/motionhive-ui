import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { LoggedSet, RestSources, WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

import { RestLiveAction, RestLiveActionTypes } from '../../../_shared/native/rest-live';
import { ActiveSessionStore, LiveStep } from './active-session.store';
import { LockScreenService } from './lock-screen.service';
import { WorkoutSettingsStore } from './workout-settings.store';

const START = Date.parse('2026-11-07T17:00:00Z');

function step(setId: string, fields: Partial<LiveStep> = {}): LiveStep {
  return {
    exercise: 'Bench press',
    set: 'Set 2',
    target: '62.5 kg × 8',
    last: '',
    done: 1,
    total: 4,
    workoutDone: 1,
    workoutTotal: 8,
    kicker: '',
    order: '',
    exerciseId: 'ex-1',
    setId,
    values: { weightKg: 62.5, reps: 8 },
    short: '62.5 × 8',
    rest: 90,
    line: `${setId} · 62.5 kg × 8 · Bench press`,
    final: false,
    ...fields,
  };
}

function setup() {
  const logSet = vi.fn(() => of({} as LoggedSet));
  const resume = vi.fn(() =>
    of({
      id: 'wl-1',
      name: 'Push day',
      startedAt: new Date(START).toISOString(),
      pausedAt: null,
      pausedSeconds: 240,
      status: WorkoutLogStatus.InProgress,
    } as WorkoutLog),
  );
  TestBed.configureTestingModule({
    providers: [
      LockScreenService,
      ActiveSessionStore,
      {
        provide: WorkoutLogService,
        useValue: { logSet, resume, getInProgress: () => of(undefined) },
      },
      { provide: WorkoutSettingsStore, useValue: {} },
      { provide: TranslateService, useValue: {} },
    ],
  });
  const store = TestBed.inject(ActiveSessionStore);
  store.track({
    id: 'wl-1',
    name: 'Push day',
    startedAt: new Date(START).toISOString(),
    pausedAt: null,
    pausedSeconds: 0,
    status: WorkoutLogStatus.InProgress,
  });
  const service = TestBed.inject(LockScreenService);
  // What the native side hands over; the logger is closed, so the service applies it.
  const apply = (action: RestLiveAction) => service['_apply'](action);
  return { store, logSet, resume, apply };
}

describe('LockScreenService, the lock screen buttons with the logger closed', () => {
  it('saves a ✓ at the moment of the tap and runs the rest after it, as the lock screen does', () => {
    const { store, logSet, apply } = setup();
    store.setNext('wl-1', 'set-2 · 62.5 kg × 8 · Bench press', [step('set-2'), step('set-3')]);
    store.setRest({
      logId: 'wl-1',
      exerciseId: 'ex-1',
      setId: 'set-1',
      startedAt: START,
      endsAt: START + 90_000,
      planned: 90,
      next: '',
    });
    const at = START + 150_000;

    apply({ type: RestLiveActionTypes.Log, at, setId: 'set-2', exerciseId: 'ex-1', values: { weightKg: 62.5, reps: 8, rpe: 9 } });

    // The rest before it, estimated as a tick in the app would: the gap less the set's own length.
    expect(logSet).toHaveBeenCalledWith('wl-1', 'set-1', { restAfterSeconds: 126, restSource: RestSources.Estimated });
    expect(logSet).toHaveBeenCalledWith('wl-1', 'set-2', {
      weightKg: 62.5,
      reps: 8,
      isCompleted: true,
      completedAt: new Date(at).toISOString(),
    });
    expect(store.rest()).toEqual({
      logId: 'wl-1',
      exerciseId: 'ex-1',
      setId: 'set-2',
      startedAt: at,
      endsAt: at + 90_000,
      planned: 90,
      next: 'set-3 · 62.5 kg × 8 · Bench press',
    });
    expect(store.liveSteps().map((s) => s.setId)).toEqual(['set-3']);
  });

  it('starts no rest after a ✓ that has none', () => {
    const { store, apply } = setup();
    store.setNext('wl-1', '', [step('set-2', { rest: null, final: true })]);

    apply({ type: RestLiveActionTypes.Log, at: START, setId: 'set-2', exerciseId: 'ex-1', values: { reps: 8 } });

    expect(store.rest()).toBeNull();
    expect(store.liveSteps()).toEqual([]);
  });

  it('passes a skipped set over and leaves it unticked', () => {
    const { store, logSet, apply } = setup();
    store.setNext('wl-1', '', [step('set-2'), step('set-3')]);

    apply({ type: RestLiveActionTypes.SkipSet, at: START, setId: 'set-2' });

    expect(store.passed().has('set-2')).toBe(true);
    expect(store.liveSteps().map((s) => s.setId)).toEqual(['set-3']);
    expect(logSet).not.toHaveBeenCalled();
  });

  it('ends the pause when Continue was tapped', () => {
    const { store, resume, apply } = setup();
    const at = START + 600_000;

    apply({ type: RestLiveActionTypes.Resume, at });

    expect(resume).toHaveBeenCalledWith('wl-1', at);
    expect(store.session()?.pausedSeconds).toBe(240);
  });
});
