import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { LoggedSet, WorkoutLog, WorkoutLogService } from 'core';

import { LoggerStore } from './logger.store';

function log(): WorkoutLog {
  return {
    id: 'wl-1',
    exercises: [{ id: 'ex-1', sets: [{ id: 's-1', isCompleted: false }] }],
  } as WorkoutLog;
}

function setup() {
  // One reply per write, answered by the test when it chooses.
  const replies: Subject<LoggedSet>[] = [];
  const logSet = vi.fn(() => {
    const reply = new Subject<LoggedSet>();
    replies.push(reply);
    return reply;
  });

  TestBed.configureTestingModule({
    providers: [LoggerStore, { provide: WorkoutLogService, useValue: { logSet } }],
  });
  const store = TestBed.inject(LoggerStore);
  store.adopt(log());

  const answer = (index: number) => {
    replies[index].next({ id: 's-1', isCompleted: true } as LoggedSet);
    replies[index].complete();
  };
  return { store, logSet, answer };
}

describe('LoggerStore.whenSettled — Finish waits for the last tick', () => {
  it('runs at once when nothing is being written', () => {
    const { store } = setup();
    const then = vi.fn();

    store.whenSettled(then);

    expect(then).toHaveBeenCalledOnce();
  });

  it('waits for a set write still on its way', () => {
    // Completing first would make the API refuse this tick, and it would
    // be lost from a workout the user has just finished.
    const { store, answer } = setup();
    const then = vi.fn();

    store.logSet('ex-1', 's-1', { isCompleted: true });
    store.whenSettled(then);
    expect(then).not.toHaveBeenCalled();

    answer(0);
    expect(then).toHaveBeenCalledOnce();
  });

  it('waits for an edit queued behind the write in flight', () => {
    const { store, logSet, answer } = setup();
    const then = vi.fn();

    store.logSet('ex-1', 's-1', { isCompleted: true });
    store.logSet('ex-1', 's-1', { reps: 8 });
    store.whenSettled(then);

    answer(0);
    // The queued edit goes out now; finishing still has to wait for it.
    expect(logSet).toHaveBeenCalledTimes(2);
    expect(then).not.toHaveBeenCalled();

    answer(1);
    expect(then).toHaveBeenCalledOnce();
  });
});
