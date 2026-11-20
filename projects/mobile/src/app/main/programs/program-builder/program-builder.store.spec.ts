import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Program, ProgramService, ProgramWorkout } from 'core';

import { ProgramBuilderStore } from './program-builder.store';

function day(id: string, weekIndex: number, dayIndex: number, exercises = 0): ProgramWorkout {
  return {
    id,
    programId: 'p-1',
    name: id,
    weekIndex,
    dayIndex,
    exercises: Array.from({ length: exercises }, (_, i) => ({ id: `${id}-e${i}`, sets: [] })),
  } as unknown as ProgramWorkout;
}

function program(workouts: ProgramWorkout[], over: Partial<Program> = {}): Program {
  return {
    id: 'p-1',
    name: 'Strength base',
    status: 'DRAFT',
    durationDays: 28,
    workouts,
    ...over,
  } as unknown as Program;
}

function setup(start: Program) {
  const removes = new Subject<void>();
  const removeWorkout = vi.fn(() => removes.asObservable());
  const copyWeek = vi.fn(() => of(undefined));
  const update = vi.fn(() => of({ id: 'p-1', name: 'Renamed', status: 'DRAFT', durationDays: 28 }));
  const get = vi.fn(() => of(start));
  const insertWeekAfter = vi.fn(() => of(program([day('w3', 2, 0)])));
  const clearWeek = vi.fn(() => of(program([])));
  TestBed.configureTestingModule({
    providers: [
      ProgramBuilderStore,
      {
        provide: ProgramService,
        useValue: { removeWorkout, copyWeek, update, get, insertWeekAfter, clearWeek },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const store = TestBed.inject(ProgramBuilderStore);
  store.adopt(start);
  return { store, removeWorkout, removes, copyWeek, update, get, insertWeekAfter, clearWeek };
}

describe('ProgramBuilderStore, clearing a day with undo', () => {
  it('takes the day off the grid at once and holds its delete', () => {
    const { store, removeWorkout } = setup(program([day('mon', 0, 0, 2), day('wed', 0, 2, 1)]));

    const cleared = store.clearDay('mon');

    expect(cleared?.id).toBe('mon');
    expect(store.workouts().map((w) => w.id)).toEqual(['wed']);
    expect(store.pendingClearId()).toBe('mon');
    expect(removeWorkout).not.toHaveBeenCalled();
  });

  it('puts the day back on undo and never sends the delete', () => {
    const { store, removeWorkout } = setup(program([day('mon', 0, 0, 2)]));
    store.clearDay('mon');

    store.undoClear('mon');

    expect(store.workouts().map((w) => w.id)).toEqual(['mon']);
    expect(store.exerciseDays()).toBe(1);
    expect(store.pendingClearId()).toBeNull();
    expect(removeWorkout).not.toHaveBeenCalled();
  });

  it('sends the delete once the toast closes', () => {
    const { store, removeWorkout } = setup(program([day('mon', 0, 0, 2)]));
    store.clearDay('mon');

    store.flushClear('mon');

    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');
    expect(store.pendingClearId()).toBeNull();
  });

  it('lets a late toast neither send nor undo a newer clear', () => {
    const { store, removeWorkout } = setup(program([day('mon', 0, 0), day('wed', 0, 2)]));
    store.clearDay('mon');
    // Clearing another sends the first one rather than keeping two waiting.
    store.clearDay('wed');
    expect(removeWorkout).toHaveBeenCalledTimes(1);
    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');

    store.flushClear('mon');
    store.undoClear('mon');

    expect(removeWorkout).toHaveBeenCalledTimes(1);
    expect(store.pendingClearId()).toBe('wed');
    expect(store.workouts()).toEqual([]);
  });

  it('holds a write that could see the cleared day until its delete has landed', () => {
    const { store, removeWorkout, removes, copyWeek } = setup(
      program([day('mon', 0, 0, 1), day('tue', 0, 1, 1)]),
    );
    store.clearDay('mon');

    store.copyWeek(0, [1]);

    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');
    expect(copyWeek).not.toHaveBeenCalled();
    removes.next();
    expect(copyWeek).toHaveBeenCalledWith('p-1', 0, [1]);
  });

  it('keeps a held day cleared when the program is read again', () => {
    const { store } = setup(program([day('mon', 0, 0, 1), day('wed', 0, 2, 1)]));
    store.clearDay('mon');

    store.refresh();

    expect(store.workouts().map((w) => w.id)).toEqual(['wed']);
  });

  it('sends a held delete when the page goes', () => {
    const { store, removeWorkout } = setup(program([day('mon', 0, 0, 1)]));
    store.clearDay('mon');

    TestBed.resetTestingModule();

    expect(removeWorkout).toHaveBeenCalledWith('p-1', 'mon');
  });
});

describe('ProgramBuilderStore, what the page reads', () => {
  it('counts only days with an exercise toward publishing', () => {
    const { store } = setup(program([day('mon', 0, 0, 3), day('wed', 0, 2, 0), day('fri', 1, 4, 1)]));
    expect(store.filledDays()).toBe(3);
    expect(store.exerciseDays()).toBe(2);
  });

  it('finds the first day in the order a client meets them', () => {
    const { store } = setup(program([day('w2', 1, 0), day('thu', 0, 3), day('tue', 0, 1)]));
    expect(store.firstDay()?.id).toBe('tue');
  });

  it('has no first day in an empty program', () => {
    const { store } = setup(program([]));
    expect(store.firstDay()).toBeNull();
  });

  it('reads the client count from the detail read, 0 when absent', () => {
    expect(setup(program([], { clientCount: 3 })).store.clientCount()).toBe(3);
    TestBed.resetTestingModule();
    expect(setup(program([])).store.clientCount()).toBe(0);
  });

  it('keeps the client count and the days through a details save', () => {
    const { store } = setup(program([day('mon', 0, 0, 1)], { clientCount: 2 }));
    const done = vi.fn();

    store.saveDetails({ name: 'Renamed', description: '', weeks: 4, repeatNewWeeks: false }, done);

    expect(done).toHaveBeenCalledWith();
    expect(store.program()?.name).toBe('Renamed');
    expect(store.clientCount()).toBe(2);
    expect(store.workouts().map((w) => w.id)).toEqual(['mon']);
  });
});

describe('ProgramBuilderStore, a week at a time', () => {
  it('copies one week into several in one request, the source and repeats left out', () => {
    const { store, copyWeek } = setup(program([day('mon', 0, 0, 1)]));
    const done = vi.fn();

    store.copyWeek(0, [2, 0, 3, 2], done);

    expect(copyWeek).toHaveBeenCalledOnce();
    expect(copyWeek).toHaveBeenCalledWith('p-1', 0, [2, 3]);
    expect(done).toHaveBeenCalledWith();
  });

  it('sends nothing for a copy with no other week or nothing in the source', () => {
    const { store, copyWeek } = setup(program([day('mon', 0, 0, 1)]));
    store.copyWeek(0, [0]);
    store.copyWeek(1, [2]);
    expect(copyWeek).not.toHaveBeenCalled();
  });

  it('adds a week after one and shows the program the server answers with', () => {
    const { store, insertWeekAfter } = setup(program([day('mon', 0, 0, 1)]));
    const done = vi.fn();

    store.insertWeekAfter(1, done);

    expect(insertWeekAfter).toHaveBeenCalledWith('p-1', 1);
    expect(store.workouts().map((w) => w.id)).toEqual(['w3']);
    expect(done).toHaveBeenCalledWith();
  });

  it('clears a week once a held day in it has been deleted', () => {
    const { store, clearWeek, removes } = setup(program([day('mon', 0, 0, 1), day('tue', 0, 1, 1)]));
    store.clearDay('mon');

    store.clearWeek(0);
    expect(clearWeek).not.toHaveBeenCalled();
    removes.next();

    expect(clearWeek).toHaveBeenCalledWith('p-1', 0);
    expect(store.workouts()).toEqual([]);
  });
});
