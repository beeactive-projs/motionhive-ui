import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AssignedSet,
  ClientCopyService,
  CopyDayDetail,
  CopyDayLock,
  CopyExercise,
  CopyExerciseChange,
  Exercise,
  PrescribedSet,
  Program,
  ProgramAssignmentStatus,
  ProgramService,
  SetFields,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { DayEditor } from './day-editor';
import { CopyDaySource, DaySource } from './day-source';

function set(id: string, orderIndex: number): PrescribedSet {
  return {
    id,
    prescribedExerciseId: 'x',
    orderIndex,
    setType: 'NORMAL',
    targetRepsMin: 8,
    targetRepsMax: 8,
    targetWeightKg: 60,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: null,
    targetRir: null,
    restAfterSeconds: 90,
    tempo: null,
    notes: null,
  } as PrescribedSet;
}

/** A day of A1 B1 C D E2 F2, each with two sets. */
function program(): Program {
  const row = (id: string, supersetGroupId: number | null, orderIndex: number) => ({
    id,
    exerciseId: `ex-${id}`,
    supersetGroupId,
    orderIndex,
    notes: null,
    exercise: { id: `ex-${id}`, name: id.toUpperCase(), kind: 'STRENGTH', thumbnailUrl: null },
    sets: [set(`${id}-1`, 0), set(`${id}-2`, 1)],
  });
  return {
    id: 'p-1',
    defaultRestSeconds: null,
    workouts: [
      {
        id: 'pw-1',
        name: 'Day 1',
        notes: null,
        weekIndex: 0,
        dayIndex: 0,
        defaultRestSeconds: null,
        estimatedDurationMinutes: null,
        exercises: [
          row('a', 1, 0),
          row('b', 1, 1),
          row('c', null, 2),
          row('d', null, 3),
          row('e', 2, 4),
          row('f', 2, 5),
        ],
      },
    ],
  } as unknown as Program;
}

/** Lets the awaited saves and their follow-ups settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

function setup() {
  const setSupersets = vi.fn(() => of(undefined));
  const reorderExercises = vi.fn(() => of([]));
  const addExercises = vi.fn(() => of([]));
  const updateExercise = vi.fn(() => of({}));
  const setSets = vi.fn((_p: string, _w: string, exerciseId: string, sets: { id?: string }[]) =>
    of(sets.map((item, index) => ({ ...set(item.id ?? `${exerciseId}-saved-${index}`, index) }))),
  );
  const get = vi.fn(() => of(program()));
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ProgramService,
        useValue: { get, setSupersets, reorderExercises, addExercises, updateExercise, setSets },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p-1', workoutId: 'pw-1' }) } },
      },
      { provide: Router, useValue: { url: '/tabs/programs/program/p-1/day/pw-1', navigate: vi.fn() } },
      { provide: FeedbackService, useValue: { error: vi.fn(() => Promise.resolve()) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
    ],
  });
  const editor = TestBed.runInInjectionContext(() => new DayEditor());
  editor.ionViewWillEnter();
  return { editor, setSupersets, reorderExercises, addExercises, updateExercise, setSets, get };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('DayEditor, the day as blocks', () => {
  it('draws a superset as one block, its members labelled by the block', () => {
    const { editor } = setup();
    const blocks = editor.blocks();
    expect(blocks.map((block) => block.members.map((member) => member.row.key))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
      ['e', 'f'],
    ]);
    expect(blocks[0].superset).toBe(true);
    expect(blocks[0].members.map((member) => member.tag)).toEqual(['1A', '1B']);
    expect(blocks[1].members[0].tag).toBeNull();
    // A superset's rest is said once, after the round: its last member's.
    expect(blocks[0].restLabel).toBe('programs.dayEditor.superset.restAfter');
    expect(blocks[0].members[0].inSuperset).toBe(true);
  });

  it('links a block with the next in one request, renumbering the rest', async () => {
    const { editor, setSupersets } = setup();
    editor.linkWithNext(editor.blocks()[1]);
    await settle();

    expect(setSupersets).toHaveBeenCalledOnce();
    expect(setSupersets).toHaveBeenCalledWith('p-1', 'pw-1', [
      { id: 'c', supersetGroupId: 2 },
      { id: 'd', supersetGroupId: 2 },
      { id: 'e', supersetGroupId: 3 },
      { id: 'f', supersetGroupId: 3 },
    ]);
  });

  it('unlinks a whole superset in one request', async () => {
    const { editor, setSupersets } = setup();
    editor.unlink(editor.blocks()[3]);
    await settle();

    expect(setSupersets).toHaveBeenCalledWith('p-1', 'pw-1', [
      { id: 'e', supersetGroupId: null },
      { id: 'f', supersetGroupId: null },
    ]);
  });

  it('moves an exercise past a whole superset, in one reorder of the day', async () => {
    const { editor, reorderExercises } = setup();
    editor.openMove(editor.drafts()[3]);
    expect(editor.moveActions().map((action) => action.id)).toEqual(['moveUp', 'moveDown']);

    editor.onMove('moveDown');
    await settle();

    expect(reorderExercises).toHaveBeenCalledOnce();
    expect(reorderExercises).toHaveBeenCalledWith('p-1', 'pw-1', {
      items: ['a', 'b', 'c', 'e', 'f', 'd'].map((id, orderIndex) => ({ id, orderIndex })),
    });
  });
});

describe("DayEditor, an exercise's targets", () => {
  it('saves a run of stepper taps as one request, the sets kept by id', async () => {
    vi.useFakeTimers();
    const { editor, setSets } = setup();
    const c = editor.drafts()[2];

    editor.stepTarget(c, { field: null, delta: 1 });
    editor.stepTarget(editor.drafts()[2], { field: SetFields.Reps, delta: 1 });
    expect(setSets).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);

    expect(setSets).toHaveBeenCalledOnce();
    const [, , exerciseId, sets] = setSets.mock.calls[0];
    expect(exerciseId).toBe('c');
    expect(sets.map((item) => item.id)).toEqual(['c-1', 'c-2', undefined]);
    expect(sets.every((item) => (item as { targetRepsMin?: number }).targetRepsMin === 9)).toBe(true);
    // The new set takes the id the save gave it, so the next save updates it.
    expect(editor.drafts()[2].sets.map((s) => s.key)).toEqual(['c-1', 'c-2', 'c-saved-2']);
  });

  it('sends what is waiting before it leaves', async () => {
    const { editor, setSets } = setup();
    editor.addSet(editor.drafts()[2]);
    editor.ionViewWillLeave();
    await settle();
    expect(setSets).toHaveBeenCalledOnce();
  });

  it('puts a target effort on every working set, saved with the sets', async () => {
    vi.useFakeTimers();
    const { editor, setSets } = setup();
    editor.openRpe(editor.drafts()[2]);
    editor.pickRpe('8');
    expect(editor.views()[2].rpe).toBe('RPE 8');
    await vi.advanceTimersByTimeAsync(800);

    const sets = setSets.mock.calls[0][3] as { targetRpe?: number }[];
    expect(sets.map((item) => item.targetRpe)).toEqual([8, 8]);
  });

  it("gives an exercise in a superset no rest of its own: the block's says the round's", () => {
    const { editor } = setup();
    expect(editor.views()[0].inSuperset).toBe(true);
    expect(editor.views()[2].inSuperset).toBe(false);
  });

  it('opens set by set and back, flattening to the first working set', async () => {
    vi.useFakeTimers();
    const { editor, setSets } = setup();
    editor.setMode(editor.drafts()[2], 'perSet');
    expect(editor.drafts()[2].perSet).toBe(true);
    // Opening the table changes no target, so nothing is saved.
    await vi.advanceTimersByTimeAsync(800);
    expect(setSets).not.toHaveBeenCalled();

    editor.addWarmup(editor.drafts()[2]);
    editor.setMode(editor.drafts()[2], 'all');
    expect(editor.drafts()[2].perSet).toBe(false);
    await vi.advanceTimersByTimeAsync(800);
    expect(setSets).toHaveBeenCalledOnce();
  });
});

describe('DayEditor, adding exercises', () => {
  it('adds every movement picked in one request, three sets each', async () => {
    const { editor, addExercises } = setup();
    editor.onPicked([{ id: 'ex-1' }, { id: 'ex-2' }] as Exercise[]);
    await settle();

    expect(addExercises).toHaveBeenCalledOnce();
    expect(addExercises).toHaveBeenCalledWith('p-1', 'pw-1', [
      { exerciseId: 'ex-1', defaultSets: 3 },
      { exerciseId: 'ex-2', defaultSets: 3 },
    ]);
  });

  it("saves a coach's note on the exercise, and an emptied one as none", async () => {
    const { editor, updateExercise } = setup();
    editor.openNote(editor.drafts()[2]);
    editor.saveNote('Pause at the bottom');
    await settle();
    expect(updateExercise).toHaveBeenCalledWith('p-1', 'pw-1', 'c', { notes: 'Pause at the bottom' });

    editor.openNote(editor.drafts()[2]);
    editor.saveNote(null);
    await settle();
    expect(updateExercise).toHaveBeenLastCalledWith('p-1', 'pw-1', 'c', { notes: '' });
  });
});

/** One client's copy of a day: Bench press (changed, linked) and Rows (as assigned). */
function copyDetail(): CopyDayDetail {
  const assigned = (id: string, exerciseKey: string, orderIndex: number): AssignedSet => ({
    id,
    assignedExerciseId: exerciseKey,
    masterSetId: `p-${id}`,
    orderIndex,
    setType: 'NORMAL',
    targetRepsMin: 8,
    targetRepsMax: 8,
    targetWeightKg: 57.5,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: null,
    targetRir: null,
    restAfterSeconds: 120,
    tempo: null,
    notes: null,
  });
  const programValues = {
    exerciseId: 'ex-bench',
    exercise: { id: 'ex-bench', name: 'Bench', slug: 'bench', kind: 'STRENGTH', level: 'BEGINNER', thumbnailUrl: null },
    notes: null,
    sets: [],
  };
  const row = (id: string, change: CopyExerciseChange, orderIndex: number): CopyExercise => ({
    id,
    exerciseId: `ex-${id}`,
    masterExerciseId: `pe-${id}`,
    supersetGroupId: null,
    orderIndex,
    notes: null,
    isModifiedFromMaster: change !== CopyExerciseChange.None,
    exercise: { id: `ex-${id}`, name: id.toUpperCase(), slug: id, kind: 'STRENGTH', level: 'BEGINNER', thumbnailUrl: null },
    sets: [assigned(`${id}-1`, id, 0), assigned(`${id}-2`, id, 1)],
    change,
    canRevert: change !== CopyExerciseChange.None,
    program: { ...programValues, exerciseId: `ex-${id}` },
    lastResult: null,
  });
  return {
    today: '2026-11-20',
    move: { from: '2026-11-20', to: '2026-12-25', taken: ['2026-11-25'] },
    assignment: {
      id: 'a-1',
      status: ProgramAssignmentStatus.Active,
      programNameSnapshot: 'Strength Base',
      masterProgramId: 'p-1',
      startDate: '2026-11-02',
      endDate: '2026-12-25',
      completionPercent: 25,
      clientId: 'client-1',
      client: { id: 'client-1', firstName: 'Anna', lastName: 'Popescu', avatarUrl: null, handle: null },
    },
    day: {
      id: 'd-1',
      name: 'Push A',
      notes: null,
      weekIndex: 2,
      dayIndex: 0,
      scheduledDate: '2026-11-23',
      status: null,
      lock: null,
      editable: true,
      changed: true,
      exercises: [row('bench', CopyExerciseChange.Changed, 0), row('rows', CopyExerciseChange.None, 1)],
    },
  };
}

function setupCopy() {
  const programService = { get: vi.fn(), setSupersets: vi.fn(() => of(undefined)), updateWorkout: vi.fn() };
  const copyService = {
    day: vi.fn(() => of(copyDetail())),
    setSets: vi.fn((_a: string, _d: string, exerciseId: string, sets: { id?: string }[]) =>
      of(sets.map((item, index) => ({ ...copyDetail().day.exercises[0].sets[0], id: item.id ?? `${exerciseId}-saved-${index}`, orderIndex: index }))),
    ),
    updateExercise: vi.fn(() => of({})),
    addExercises: vi.fn(() => of([])),
    removeExercise: vi.fn(() => of(undefined)),
    reorderExercises: vi.fn(() => of([])),
    revert: vi.fn(() => of({})),
    moveDay: vi.fn(() => of({})),
  };
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ProgramService, useValue: programService },
      { provide: ClientCopyService, useValue: copyService },
      { provide: DaySource, useClass: CopyDaySource },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ assignmentId: 'a-1', dayId: 'd-1' }) } },
      },
      { provide: Router, useValue: { url: '/tabs/clients/copy/a-1/day/d-1', navigate } },
      { provide: FeedbackService, useValue: { error: vi.fn(() => Promise.resolve()) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
    ],
  });
  const editor = TestBed.runInInjectionContext(() => new DayEditor());
  editor.ionViewWillEnter();
  return { editor, copyService, programService, navigate };
}

describe("DayEditor on a client's copy", () => {
  it("reads the copy's day, with whose it is and each exercise's label", () => {
    const { editor, copyService, programService } = setupCopy();
    expect(copyService.day).toHaveBeenCalledWith('a-1', 'd-1');
    expect(programService.get).not.toHaveBeenCalled();
    expect(editor.isCopy).toBe(true);
    expect(editor.copyHeader()?.title).toBe("Anna's copy");
    const [bench, rows] = editor.views();
    expect(bench.copy?.badge).toBe('Changed for Anna');
    expect(bench.copy?.canRevert).toBe(true);
    expect(rows.copy?.badge).toBeNull();
    expect(editor.builderUrl()).toBe('/tabs/clients/copy/a-1');
  });

  it("saves an exercise's sets on the copy and marks it changed at once", async () => {
    vi.useFakeTimers();
    const { editor, copyService } = setupCopy();
    editor.stepTarget(editor.drafts()[1], { field: SetFields.Reps, delta: 1 });
    await vi.advanceTimersByTimeAsync(800);

    expect(copyService.setSets).toHaveBeenCalledOnce();
    const [assignmentId, dayId, exerciseId, sets] = copyService.setSets.mock.calls[0];
    expect([assignmentId, dayId, exerciseId]).toEqual(['a-1', 'd-1', 'rows']);
    expect(sets.map((item) => item.id)).toEqual(['rows-1', 'rows-2']);
    expect(editor.views()[1].copy?.badge).toBe('Changed for Anna');
  });

  it('swaps a movement through the picker, one exercise for one', async () => {
    const { editor, copyService } = setupCopy();
    editor.openMove(editor.drafts()[0]);
    expect(editor.moveActions().map((action) => action.id)).toEqual(['moveDown', 'swap']);
    editor.onMove('swap');
    expect(editor.pickerOpen()).toBe(true);
    expect(editor.swapFor()).toBe('bench');

    editor.onPicked([{ id: 'ex-db-press' }] as Exercise[]);
    await settle();
    expect(copyService.updateExercise).toHaveBeenCalledWith('a-1', 'd-1', 'bench', { exerciseId: 'ex-db-press' });
    expect(copyService.addExercises).not.toHaveBeenCalled();
    expect(editor.swapFor()).toBeNull();
  });

  it('adds, reorders and removes on the copy, never on the program', async () => {
    const { editor, copyService, programService } = setupCopy();
    editor.openPicker();
    editor.onPicked([{ id: 'ex-1' }] as Exercise[]);
    await settle();
    expect(copyService.addExercises).toHaveBeenCalledWith('a-1', 'd-1', [{ exerciseId: 'ex-1', defaultSets: 3 }]);

    editor.openMove(editor.drafts()[1]);
    editor.onMove('moveUp');
    await settle();
    expect(copyService.reorderExercises).toHaveBeenCalledWith('a-1', 'd-1', {
      items: [
        { id: 'rows', orderIndex: 0 },
        { id: 'bench', orderIndex: 1 },
      ],
    });

    editor.askRemove(editor.drafts()[0]);
    expect(editor.removeBody()).toBe('programs.clientCopy.removeBody');
    editor.confirmRemove();
    await settle();
    expect(copyService.removeExercise).toHaveBeenCalledWith('a-1', 'd-1', expect.any(String));

    // The program's own shape stays off a copy.
    editor.linkWithNext(editor.blocks()[0]);
    await settle();
    expect(programService.setSupersets).not.toHaveBeenCalled();
  });

  it("puts an exercise back to the program's values after asking", async () => {
    const { editor, copyService } = setupCopy();
    editor.askRevert(editor.drafts()[0]);
    expect(editor.revertOpen()).toBe(true);
    editor.confirmRevert();
    await settle();
    expect(copyService.revert).toHaveBeenCalledWith('a-1', 'd-1', 'bench');
  });

  it('moves the day only to a free date inside the plan', async () => {
    const { editor, copyService } = setupCopy();
    expect(editor.dateEnabled('2026-11-26')).toBe(true);
    expect(editor.dateEnabled('2026-11-25')).toBe(false);
    expect(editor.dateEnabled('2026-11-19')).toBe(false);

    editor.moveDate('2026-11-25');
    editor.moveDate('2026-11-23');
    await settle();
    expect(copyService.moveDay).not.toHaveBeenCalled();

    editor.moveDate('2026-11-26T00:00:00');
    await settle();
    expect(copyService.moveDay).toHaveBeenCalledWith('a-1', 'd-1', '2026-11-26');
  });

  it('says why a day that became locked can no longer change', () => {
    const { editor } = setupCopy();
    expect(editor.copyLockNote()).toBeNull();
    editor.copy.update((copy) => {
      if (!copy) {
        return copy;
      }
      return { ...copy, day: { ...copy.day, editable: false, lock: CopyDayLock.Started } };
    });
    expect(editor.copyLockNote()).toBe('programs.clientCopy.dayLocked');
  });

  it("goes back to the client's copy on Done", async () => {
    const { editor, navigate } = setupCopy();
    await editor.done();
    expect(navigate).toHaveBeenCalledWith(['/tabs/clients', 'copy', 'a-1']);
  });
});
