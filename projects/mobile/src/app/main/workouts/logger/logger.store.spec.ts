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

// A set write answers with the bare row. Swapping it in whole dropped the
// set's plan: a ticked set forgot its targets, and Finish read a routine's
// own set as one the workout added.
describe('LoggerStore.logSet — the reply keeps the set’s plan', () => {
  it('keeps the plan and planned rest the reply does not carry', () => {
    const plan = { id: 'ps-1', targetRepsMin: 8, targetWeightKg: 60 };
    const reply = new Subject<LoggedSet>();
    TestBed.configureTestingModule({
      providers: [LoggerStore, { provide: WorkoutLogService, useValue: { logSet: () => reply } }],
    });
    const store = TestBed.inject(LoggerStore);
    store.adopt({
      id: 'wl-1',
      exercises: [
        {
          id: 'ex-1',
          sets: [{ id: 's-1', isCompleted: false, prescribedSet: plan, plannedRestSeconds: 120 }],
        },
      ],
    } as unknown as WorkoutLog);

    store.logSet('ex-1', 's-1', { isCompleted: true, reps: 8 });
    reply.next({ id: 's-1', isCompleted: true, reps: 8 } as LoggedSet);
    reply.complete();

    expect(store.exercises()[0].sets?.[0]).toMatchObject({
      isCompleted: true,
      reps: 8,
      prescribedSet: plan,
      plannedRestSeconds: 120,
    });
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

// Skip and swap answer with the bare row too: no sets, no exercise, no link
// to the routine. Swapped in whole, Finish read a skipped routine exercise as
// one the workout removed, and Update took it out of the routine.
describe('LoggerStore — skip and swap keep what the reply lacks', () => {
  const plan = { id: 'pe-1', notes: null };

  function planned(): WorkoutLog {
    return {
      id: 'wl-1',
      exercises: [
        {
          id: 'ex-1',
          exerciseId: 'squat',
          isSkipped: false,
          prescribedExercise: plan,
          sets: [{ id: 's-1', isCompleted: false }],
        },
      ],
    } as unknown as WorkoutLog;
  }

  /** What the API sends back: the row alone. */
  function bare(patch: object): object {
    return { id: 'ex-1', exerciseId: 'squat', isSkipped: false, ...patch };
  }

  function storeWith(service: object): LoggerStore {
    TestBed.configureTestingModule({
      providers: [LoggerStore, { provide: WorkoutLogService, useValue: service }],
    });
    const store = TestBed.inject(LoggerStore);
    store.adopt(planned());
    return store;
  }

  it('takes only the flag from a skip reply', () => {
    const store = storeWith({ setExerciseSkipped: () => of(bare({ isSkipped: true })) });

    store.setSkipped('ex-1', true);

    expect(store.exercises()[0]).toMatchObject({
      isSkipped: true,
      prescribedExercise: plan,
      sets: [{ id: 's-1' }],
    });
  });

  it('keeps the row as it was when unskipping', () => {
    const store = storeWith({ setExerciseSkipped: () => of(bare({ isSkipped: false })) });

    store.setSkipped('ex-1', true);
    store.setSkipped('ex-1', false);

    expect(store.exercises()[0]).toMatchObject({ isSkipped: false, prescribedExercise: plan });
    expect(store.exercises()[0].sets).toHaveLength(1);
  });

  it('reads the log again after a swap', () => {
    const fresh = planned();
    fresh.exercises![0] = { ...fresh.exercises![0], exerciseId: 'leg-press' };
    const get = vi.fn(() => of(fresh));
    const store = storeWith({
      swapExercise: () => of(bare({ exerciseId: 'leg-press', swappedFromExerciseId: 'squat' })),
      get,
    });
    const done = vi.fn();

    store.swapExercise('ex-1', 'leg-press', done);

    expect(get).toHaveBeenCalledWith('wl-1');
    expect(store.exercises()[0]).toMatchObject({ exerciseId: 'leg-press', sets: [{ id: 's-1' }] });
    expect(done).toHaveBeenCalledOnce();
  });

  it('lays the swap reply over the row when the read fails', () => {
    const store = storeWith({
      swapExercise: () => of(bare({ exerciseId: 'leg-press', swappedFromExerciseId: 'squat' })),
      get: () => throwError(() => ({ status: 0 })),
    });

    store.swapExercise('ex-1', 'leg-press');

    expect(store.exercises()[0]).toMatchObject({
      exerciseId: 'leg-press',
      swappedFromExerciseId: 'squat',
      prescribedExercise: plan,
      sets: [{ id: 's-1' }],
    });
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
