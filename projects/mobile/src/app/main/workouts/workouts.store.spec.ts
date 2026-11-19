import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
