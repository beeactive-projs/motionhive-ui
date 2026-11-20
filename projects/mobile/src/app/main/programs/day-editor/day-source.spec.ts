import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AssignedSet,
  ClientCopyService,
  CopyDayDetail,
  CopyExerciseChange,
  ExerciseSetType,
  ProgramAssignmentStatus,
  ProgramService,
} from 'core';

import { CopyDaySource, ProgramDaySource, assignedAsPrescribed, copyAsWorkout } from './day-source';

function assignedSet(id: string, orderIndex: number): AssignedSet {
  return {
    id,
    assignedExerciseId: 'ae-1',
    masterSetId: null,
    orderIndex,
    setType: ExerciseSetType.Normal,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetWeightKg: 57.5,
    targetWeightPercent1rm: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetRpe: 8,
    targetRir: null,
    restAfterSeconds: 120,
    tempo: null,
    notes: null,
  };
}

function detail(): CopyDayDetail {
  return {
    today: '2026-11-20',
    move: { from: '2026-11-20', to: '2026-12-25', taken: [] },
    assignment: {
      id: 'a-1',
      status: ProgramAssignmentStatus.Active,
      programNameSnapshot: 'Strength Base',
      masterProgramId: 'p-1',
      startDate: '2026-11-02',
      endDate: '2026-12-25',
      completionPercent: 25,
      clientId: 'client-1',
      client: null,
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
      changed: false,
      exercises: [
        {
          id: 'ae-1',
          exerciseId: 'bench',
          masterExerciseId: 'pe-1',
          supersetGroupId: 1,
          orderIndex: 0,
          notes: 'Slow down',
          isModifiedFromMaster: false,
          exercise: { id: 'bench', name: 'Bench press', slug: 'bench', kind: 'STRENGTH', level: 'BEGINNER', thumbnailUrl: null },
          sets: [assignedSet('s-1', 0)],
          change: CopyExerciseChange.None,
          canRevert: false,
          program: null,
          lastResult: null,
        },
      ],
    },
  };
}

/** The day editor reads a program day or a client's copy through one shape. */
describe('day sources', () => {
  it("draws a copy's day as a program day, keeping every target", () => {
    const workout = copyAsWorkout(detail());
    expect(workout).toEqual(
      expect.objectContaining({ id: 'd-1', name: 'Push A', weekIndex: 2, dayIndex: 0, defaultRestSeconds: null }),
    );
    const [row] = workout.exercises ?? [];
    expect(row).toEqual(
      expect.objectContaining({ id: 'ae-1', exerciseId: 'bench', supersetGroupId: 1, notes: 'Slow down' }),
    );
    expect(row.sets?.[0]).toEqual(
      expect.objectContaining({ id: 's-1', targetWeightKg: 57.5, targetRpe: 8, restAfterSeconds: 120 }),
    );
    expect(assignedAsPrescribed(assignedSet('s-2', 1)).orderIndex).toBe(1);
  });

  it("saves a copy's sets on the copy's route, under the plan and the day", async () => {
    const setSets = vi.fn(() => of([assignedSet('s-1', 0), assignedSet('s-new', 1)]));
    const day = vi.fn(() => of(detail()));
    TestBed.configureTestingModule({
      providers: [CopyDaySource, { provide: ClientCopyService, useValue: { setSets, day } }],
    });
    const source = TestBed.inject(CopyDaySource);

    const saved = await firstValueFrom(source.setSets('a-1', 'd-1', 'ae-1', [{ id: 's-1' }, {}]));
    expect(setSets).toHaveBeenCalledWith('a-1', 'd-1', 'ae-1', [{ id: 's-1' }, {}]);
    expect(saved.map((set) => set.id)).toEqual(['s-1', 's-new']);

    const read = await firstValueFrom(source.load('a-1', 'd-1'));
    expect(read.program).toBeNull();
    expect(read.copy?.day.id).toBe('d-1');
    expect(read.workout?.id).toBe('d-1');
    expect(source.backCommands('/tabs/clients', 'a-1')).toEqual(['/tabs/clients', 'copy', 'a-1']);
    expect(source.params).toEqual({ parent: 'assignmentId', day: 'dayId' });
  });

  it("finds a program's day in the program it reads", async () => {
    const get = vi.fn(() => of({ id: 'p-1', workouts: [{ id: 'pw-1' }, { id: 'pw-2' }] }));
    TestBed.configureTestingModule({
      providers: [{ provide: ProgramService, useValue: { get } }],
    });
    const source = TestBed.inject(ProgramDaySource);
    const read = await firstValueFrom(source.load('p-1', 'pw-2'));
    expect(read.workout?.id).toBe('pw-2');
    expect(read.copy).toBeNull();
    expect(source.backCommands('/tabs/programs', 'p-1')).toEqual(['/tabs/programs', 'program', 'p-1']);
  });
});
