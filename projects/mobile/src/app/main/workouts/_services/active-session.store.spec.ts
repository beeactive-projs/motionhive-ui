import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

import { ActiveSessionStore } from './active-session.store';
import { StillTrainingService } from './still-training.service';

const OPEN: WorkoutLog = {
  id: 'wl-1',
  name: 'Push day',
  startedAt: '2026-11-19T09:00:00Z',
  pausedAt: null,
  pausedSeconds: 0,
  status: WorkoutLogStatus.InProgress,
} as WorkoutLog;

function setup(inProgress: WorkoutLog | null | undefined) {
  const cancel = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutLogService, useValue: { getInProgress: () => of(inProgress) } },
      { provide: StillTrainingService, useValue: { cancel } },
    ],
  });
  const store = TestBed.inject(ActiveSessionStore);
  return { store, cancel };
}

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
