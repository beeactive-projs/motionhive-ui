import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgramAssignmentService, RoutineService, WorkoutLogService } from 'core';

import { WorkoutsStore } from './workouts.store';

afterEach(() => vi.useRealTimers());

describe('WorkoutsStore, today', () => {
  it("asks for the phone's own day, not the server's", () => {
    // 00:30 in Bucharest on the 19th is still the 18th in UTC.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 0, 30));
    const trainingDay = vi.fn(() => of({ today: null, week: [] }));
    const page = { items: [], total: 0 };
    TestBed.configureTestingModule({
      providers: [
        WorkoutsStore,
        { provide: ProgramAssignmentService, useValue: { trainingDay } },
        { provide: RoutineService, useValue: { list: () => of(page) } },
        { provide: WorkoutLogService, useValue: { getInProgress: () => of(null) } },
      ],
    });

    TestBed.inject(WorkoutsStore).load();

    expect(trainingDay).toHaveBeenCalledWith('2026-11-19');
  });
});

describe('WorkoutsStore, the open workout', () => {
  // Not silent, a failed read raised the "No connection" alert over a page
  // whose routines had loaded, for a card the page simply leaves out.
  it('asks for it silently, and shows none when the read fails', () => {
    const getInProgress = vi.fn(() => throwError(() => new Error('offline')));
    const page = { items: [], total: 0 };
    TestBed.configureTestingModule({
      providers: [
        WorkoutsStore,
        {
          provide: ProgramAssignmentService,
          useValue: { trainingDay: () => of({ today: null, week: [] }) },
        },
        { provide: RoutineService, useValue: { list: () => of(page) } },
        { provide: WorkoutLogService, useValue: { getInProgress } },
      ],
    });
    const store = TestBed.inject(WorkoutsStore);

    store.load();

    expect(getInProgress).toHaveBeenCalledWith({ silent: true });
    expect(store.inProgress()).toBeNull();
  });
});

describe('WorkoutsStore, your routines', () => {
  function routine(id: string) {
    return { id, name: `Routine ${id}` };
  }

  function setup() {
    const list = vi.fn((query: { library?: string; page?: number; archived?: string }) => {
      if (query.library === 'mine' && !query.archived) {
        if (query.page === 2) {
          return of({ items: [routine('r51'), routine('r52')], total: 52 });
        }
        return of({ items: [routine('r1'), routine('r2')], total: 52 });
      }
      return of({ items: [], total: 0 });
    });
    TestBed.configureTestingModule({
      providers: [
        WorkoutsStore,
        {
          provide: ProgramAssignmentService,
          useValue: { trainingDay: () => of({ today: null, week: [] }) },
        },
        { provide: RoutineService, useValue: { list } },
        { provide: WorkoutLogService, useValue: { getInProgress: () => of(null) } },
      ],
    });
    const store = TestBed.inject(WorkoutsStore);
    store.load();
    return { store, list };
  }

  // The heading counted the 50 on screen, and routine 51 was out of reach.
  it('counts every routine you have and reads the rest behind Show more', () => {
    const { store, list } = setup();
    expect(store.routineTotal()).toBe(52);
    expect(store.hasMoreRoutines()).toBe(true);

    store.loadMoreRoutines();

    expect(list).toHaveBeenLastCalledWith({ library: 'mine', page: 2, limit: 50 });
    expect(store.routines().map((r) => r.id)).toEqual(['r1', 'r2', 'r51', 'r52']);
  });

  it('counts a routine deleted from the list down at once', () => {
    const { store } = setup();
    store.dropRoutine('r1');
    expect(store.routineTotal()).toBe(51);
    store.dropRoutine('not-on-screen');
    expect(store.routineTotal()).toBe(51);
  });
});
