import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthStore, WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

import { ActiveSessionStore, LiveStep, allSetsDone } from './active-session.store';
import { StillTrainingService } from './still-training.service';

const OPEN: WorkoutLog = {
  id: 'wl-1',
  name: 'Push day',
  startedAt: '2026-11-19T09:00:00Z',
  pausedAt: null,
  pausedSeconds: 0,
  status: WorkoutLogStatus.InProgress,
} as WorkoutLog;

function setup(inProgress: WorkoutLog | null | undefined, userId: string | null = 'me') {
  const cancel = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutLogService, useValue: { getInProgress: () => of(inProgress) } },
      { provide: StillTrainingService, useValue: { cancel } },
      { provide: AuthStore, useValue: { user: () => (userId ? { id: userId } : null) } },
    ],
  });
  const store = TestBed.inject(ActiveSessionStore);
  return { store, cancel };
}

/** Where Capacitor's Preferences keep a key in the browser (and in jsdom). */
const KEPT = 'CapacitorStorage.mh-active-session';

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

/**
 * The open workout is kept on the phone (user decision, 2026-11-19), so a
 * phone that restarts with no signal still shows the mini-bar. It showed
 * nothing until the API answered, and nothing at all offline.
 */
describe('ActiveSessionStore, the workout kept on the phone', () => {
  const kept = (userId: string) =>
    JSON.stringify({
      id: 'wl-1',
      name: 'Push day',
      startedAt: '2026-11-19T09:00:00Z',
      pausedAt: null,
      pausedSeconds: 0,
      userId,
    });

  it('keeps the workout the API says is open, with whose it is', async () => {
    setup(OPEN);
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem(KEPT) ?? 'null')).toMatchObject({
        id: 'wl-1',
        name: 'Push day',
        userId: 'me',
      }),
    );
  });

  it('shows it again after a restart while the API has not answered', async () => {
    localStorage.setItem(KEPT, kept('me'));
    const { store } = setup(undefined);
    await vi.waitFor(() => expect(store.session()?.id).toBe('wl-1'));
    expect(store.session()).toEqual({
      id: 'wl-1',
      name: 'Push day',
      startedAt: '2026-11-19T09:00:00Z',
      pausedAt: null,
      pausedSeconds: 0,
    });
    // Kept is not checked: only the API can say a workout is open.
    expect(store.checked()).toBe(false);
  });

  it('never shows one account the workout another left open', async () => {
    localStorage.setItem(KEPT, kept('someone-else'));
    const { store } = setup(undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(store.session()).toBeNull();
  });

  it('lets the API have the last word: nothing open drops what was kept', async () => {
    localStorage.setItem(KEPT, kept('me'));
    const { store } = setup(null);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(store.session()).toBeNull();
    expect(localStorage.getItem(KEPT)).toBeNull();
  });
});

describe('ActiveSessionStore, a workout ending', () => {
  it('takes "Still training?" away when the workout ends', () => {
    const { store, cancel } = setup(OPEN);
    expect(store.session()?.id).toBe('wl-1');
    expect(cancel).not.toHaveBeenCalled();

    store.end();

    expect(store.session()).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('takes it away when the API says nothing is open, as after the overnight close', () => {
    const { store, cancel } = setup(null);
    expect(store.checked()).toBe(true);
    expect(store.session()).toBeNull();
    expect(cancel).toHaveBeenCalled();
  });

  it('leaves it while the API has not answered', () => {
    const { cancel } = setup(undefined);
    expect(cancel).not.toHaveBeenCalled();
  });
});

/** Enough of a step for the store to move on past it. */
const step = (setId: string) => ({ setId, line: `Next ${setId}` }) as LiveStep;

describe('ActiveSessionStore, sets done', () => {
  // The API's in-progress answer carries no sets: the resume card's
  // "7 of 13 sets" is what the logger last counted.
  it('keeps the count the logger last gave, for its own workout only', () => {
    const { store } = setup(OPEN);
    expect(store.progress()).toBeNull();

    store.setNext('wl-1', '', [], { done: 7, total: 13 });
    expect(store.progress()).toEqual({ done: 7, total: 13 });
    expect(store.allDone()).toBe(false);

    store.setNext('wl-old', '', [], { done: 13, total: 13 });
    expect(store.progress()).toBeNull();
    expect(store.allDone()).toBe(false);
  });

  it('is all done once every set is ticked, and never with none to tick', () => {
    const { store } = setup(OPEN);

    store.setNext('wl-1', '', [], { done: 13, total: 13 });
    expect(store.allDone()).toBe(true);

    store.setNext('wl-1', '', [], { done: 0, total: 0 });
    expect(store.allDone()).toBe(false);
  });

  it('counts a ✓ on the lock screen as a set done, and a Skip set as none', () => {
    const { store } = setup(OPEN);
    store.setNext('wl-1', 'Next s-12', [step('s-12'), step('s-13')], { done: 11, total: 13 });

    store.moveOnFrom('s-12');
    expect(store.progress()).toEqual({ done: 11, total: 13 });

    store.moveOnFrom('s-13', true);
    expect(store.progress()).toEqual({ done: 12, total: 13 });
    expect(store.liveSteps()).toEqual([]);
  });
});

describe('ActiveSessionStore, its clock', () => {
  afterEach(() => vi.useRealTimers());

  // The mini-bar and the resume card both count from it, so they agree.
  it('ticks once a second while a workout is open, and stops once it ends', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-19T10:00:00Z') });
    const { store } = setup(OPEN);
    TestBed.tick();
    const start = store.now();

    vi.advanceTimersByTime(3_000);
    expect(store.now()).toBe(start + 3_000);

    store.end();
    TestBed.tick();
    vi.advanceTimersByTime(3_000);
    expect(store.now()).toBe(start + 3_000);
  });
});

describe('allSetsDone', () => {
  it('wants every set ticked, and at least one set', () => {
    expect(allSetsDone({ done: 13, total: 13 })).toBe(true);
    expect(allSetsDone({ done: 12, total: 13 })).toBe(false);
    expect(allSetsDone({ done: 0, total: 0 })).toBe(false);
    expect(allSetsDone(null)).toBe(false);
  });
});
