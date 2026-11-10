import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseSetType, LoggedSet, WorkoutLog, WorkoutLogService } from 'core';

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

describe('LoggerStore.copySet — Copy set', () => {
  function copySetup(addSet: ReturnType<typeof vi.fn>) {
    const logSet = vi.fn(() => of({ id: 's-2', isCompleted: false } as LoggedSet));
    TestBed.configureTestingModule({
      providers: [LoggerStore, { provide: WorkoutLogService, useValue: { addSet, logSet } }],
    });
    const store = TestBed.inject(LoggerStore);
    store.adopt(log());
    return { store, logSet };
  }

  it('adds a set of the same type, last, with the numbers it was given', () => {
    const addSet = vi.fn(() => of({ id: 's-2', isCompleted: false } as LoggedSet));
    const { store, logSet } = copySetup(addSet);

    store.copySet('ex-1', ExerciseSetType.Warmup, { weightKg: 60, reps: 8 });

    expect(addSet).toHaveBeenCalledWith('wl-1', 'ex-1', { setType: ExerciseSetType.Warmup });
    expect(store.exercises()[0].sets?.map((s) => s.id)).toEqual(['s-1', 's-2']);
    expect(logSet).toHaveBeenCalledWith('wl-1', 's-2', { weightKg: 60, reps: 8 });
  });

  it('writes no numbers when the set it copies shows none', () => {
    const addSet = vi.fn(() => of({ id: 's-2', isCompleted: false } as LoggedSet));
    const { store, logSet } = copySetup(addSet);

    store.copySet('ex-1', ExerciseSetType.Normal, {});

    expect(store.exercises()[0].sets).toHaveLength(2);
    expect(logSet).not.toHaveBeenCalled();
  });

  // The page shows the refusal through FeedbackService.error(error, …), which
  // only takes down the interceptor's dialog when it gets the error itself.
  it('hands the server refusal to the caller, adding nothing', () => {
    const refusal = { status: 0 };
    const addSet = vi.fn(() => throwError(() => refusal));
    const { store } = copySetup(addSet);
    const onError = vi.fn();

    store.copySet('ex-1', ExerciseSetType.Normal, { reps: 8 }, onError);

    expect(onError).toHaveBeenCalledWith(refusal);
    expect(store.exercises()[0].sets).toHaveLength(1);
  });
});

describe('LoggerStore.removeSets — a delete the server refused', () => {
  it('hands the refusal to the caller and reads the log again', () => {
    const refusal = { status: 404 };
    const get = vi.fn(() => of(log()));
    TestBed.configureTestingModule({
      providers: [
        LoggerStore,
        {
          provide: WorkoutLogService,
          useValue: { removeSets: vi.fn(() => throwError(() => refusal)), get },
        },
      ],
    });
    const store = TestBed.inject(LoggerStore);
    store.adopt(log());
    const onError = vi.fn();

    store.removeSets([{ exerciseId: 'ex-1', setId: 's-1' }], onError);

    expect(onError).toHaveBeenCalledWith(refusal);
    expect(get).toHaveBeenCalledWith('wl-1');
    expect(store.exercises()[0].sets).toHaveLength(1);
  });
});
