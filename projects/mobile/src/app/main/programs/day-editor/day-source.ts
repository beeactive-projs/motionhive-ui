import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  AddPrescribedExerciseItem,
  AssignedSet,
  ClientCopyService,
  CopyDayDetail,
  CopyExercise,
  PrescribedExercise,
  PrescribedSet,
  PrescribedSetItem,
  Program,
  ProgramService,
  ProgramWorkout,
  ReorderPrescribedRowsPayload,
} from 'core';

/** One moved row of a reorder. */
type ReorderItem = ReorderPrescribedRowsPayload['items'][number];

/**
 * Where the day editor reads a day from and saves it to: a program's day
 * (`ProgramDaySource`, the default), or one client's copy of a plan
 * (`CopyDaySource`, owner 2026-11-20). The editor draws both the same way,
 * with the same cards, steppers, set table and number pad; the source says
 * which requests carry the change. The route provides the source.
 */
export const DaySourceKinds = {
  Program: 'program',
  Copy: 'copy',
} as const;
export type DaySourceKind = (typeof DaySourceKinds)[keyof typeof DaySourceKinds];

/** What a read hands the editor: the day as a program day, with what it belongs to. */
export interface DayLoad {
  /** The program, when editing one; its default rest is the day's fallback. */
  program: Program | null;
  /** The day, as a program day draws it (a copy's day is mapped into this). */
  workout: ProgramWorkout | null;
  /** The client's copy, when editing one: flags, program values, last results. */
  copy: CopyDayDetail | null;
}

export abstract class DaySource {
  abstract readonly kind: DaySourceKind;
  /** The route's parameter names: the parent (program or plan) and the day. */
  abstract readonly params: { parent: string; day: string };

  /** The page back and Done return to: the week grid, or the client's copy. */
  abstract backCommands(stack: string, parentId: string): string[];

  abstract load(parentId: string, dayId: string): Observable<DayLoad>;

  /** Every set of one exercise, matched by id; answers the saved sets in order. */
  abstract setSets(
    parentId: string,
    dayId: string,
    exerciseId: string,
    sets: PrescribedSetItem[],
  ): Observable<PrescribedSet[]>;

  abstract saveNote(parentId: string, dayId: string, exerciseId: string, notes: string): Observable<unknown>;

  abstract reorder(parentId: string, dayId: string, items: ReorderItem[]): Observable<unknown>;

  abstract addExercises(parentId: string, dayId: string, items: AddPrescribedExerciseItem[]): Observable<unknown>;

  abstract removeExercise(parentId: string, dayId: string, exerciseId: string): Observable<unknown>;
}

/** A day of a program: the coach's own plan, which every client copies on assign. */
@Injectable({ providedIn: 'root' })
export class ProgramDaySource extends DaySource {
  private readonly _programService = inject(ProgramService);

  readonly kind = DaySourceKinds.Program;
  readonly params = { parent: 'id', day: 'workoutId' };

  backCommands(stack: string, parentId: string): string[] {
    return [stack, 'program', parentId];
  }

  load(parentId: string, dayId: string): Observable<DayLoad> {
    return this._programService.get(parentId).pipe(
      map((program) => {
        let workout: ProgramWorkout | null = null;
        for (const day of program.workouts ?? []) {
          if (day.id === dayId) {
            workout = day;
          }
        }
        return { program, workout, copy: null };
      }),
    );
  }

  setSets(
    parentId: string,
    dayId: string,
    exerciseId: string,
    sets: PrescribedSetItem[],
  ): Observable<PrescribedSet[]> {
    return this._programService.setSets(parentId, dayId, exerciseId, sets);
  }

  saveNote(parentId: string, dayId: string, exerciseId: string, notes: string): Observable<unknown> {
    return this._programService.updateExercise(parentId, dayId, exerciseId, { notes });
  }

  reorder(parentId: string, dayId: string, items: ReorderItem[]): Observable<unknown> {
    return this._programService.reorderExercises(parentId, dayId, { items });
  }

  addExercises(parentId: string, dayId: string, items: AddPrescribedExerciseItem[]): Observable<unknown> {
    return this._programService.addExercises(parentId, dayId, items);
  }

  removeExercise(parentId: string, dayId: string, exerciseId: string): Observable<unknown> {
    return this._programService.removeExercise(parentId, dayId, exerciseId);
  }
}

/**
 * One client's copy of a plan. Its changes reach only that client; the
 * program stays as it is. Done on the copy's page tells the client.
 */
@Injectable()
export class CopyDaySource extends DaySource {
  private readonly _copyService = inject(ClientCopyService);

  readonly kind = DaySourceKinds.Copy;
  readonly params = { parent: 'assignmentId', day: 'dayId' };

  backCommands(stack: string, parentId: string): string[] {
    return [stack, 'copy', parentId];
  }

  load(parentId: string, dayId: string): Observable<DayLoad> {
    return this._copyService
      .day(parentId, dayId)
      .pipe(map((copy) => ({ program: null, workout: copyAsWorkout(copy), copy })));
  }

  setSets(
    parentId: string,
    dayId: string,
    exerciseId: string,
    sets: PrescribedSetItem[],
  ): Observable<PrescribedSet[]> {
    return this._copyService
      .setSets(parentId, dayId, exerciseId, sets)
      .pipe(map((saved) => saved.map((set) => assignedAsPrescribed(set))));
  }

  saveNote(parentId: string, dayId: string, exerciseId: string, notes: string): Observable<unknown> {
    return this._copyService.updateExercise(parentId, dayId, exerciseId, { notes });
  }

  reorder(parentId: string, dayId: string, items: ReorderItem[]): Observable<unknown> {
    return this._copyService.reorderExercises(parentId, dayId, { items });
  }

  addExercises(parentId: string, dayId: string, items: AddPrescribedExerciseItem[]): Observable<unknown> {
    return this._copyService.addExercises(parentId, dayId, items);
  }

  removeExercise(parentId: string, dayId: string, exerciseId: string): Observable<unknown> {
    return this._copyService.removeExercise(parentId, dayId, exerciseId);
  }

  // ─── What only a copy does ─────────────────────────────────────

  /** Another movement in its place; its sets stay. */
  swap(parentId: string, dayId: string, exerciseId: string, replacementId: string): Observable<unknown> {
    return this._copyService.updateExercise(parentId, dayId, exerciseId, { exerciseId: replacementId });
  }

  /** The exercise, its note and sets back to its program row as it is now. */
  revert(parentId: string, dayId: string, exerciseId: string): Observable<unknown> {
    return this._copyService.revert(parentId, dayId, exerciseId);
  }

  /** The day to another date (`YYYY-MM-DD`): free, inside the plan, never past. */
  moveDay(parentId: string, dayId: string, date: string): Observable<unknown> {
    return this._copyService.moveDay(parentId, dayId, date);
  }
}

/**
 * A set of the copy as the editor's program helpers read it. The two share
 * every target field; the copy's has no program row of its own, so the link
 * and the timestamps stand in.
 * @Arguments set
 */
export function assignedAsPrescribed(set: AssignedSet): PrescribedSet {
  return {
    id: set.id,
    prescribedExerciseId: set.assignedExerciseId,
    orderIndex: set.orderIndex,
    setType: set.setType,
    targetRepsMin: set.targetRepsMin,
    targetRepsMax: set.targetRepsMax,
    targetWeightKg: set.targetWeightKg,
    targetWeightPercent1rm: set.targetWeightPercent1rm,
    targetDurationSeconds: set.targetDurationSeconds,
    targetDistanceMeters: set.targetDistanceMeters,
    targetRpe: set.targetRpe,
    targetRir: set.targetRir,
    restAfterSeconds: set.restAfterSeconds,
    tempo: set.tempo,
    notes: set.notes,
    createdAt: '',
    updatedAt: '',
  };
}

/** An exercise of the copy as a program day's exercise. @Arguments row, dayId */
export function copyExerciseAsPrescribed(row: CopyExercise, dayId: string): PrescribedExercise {
  let exercise: PrescribedExercise['exercise'] = undefined;
  if (row.exercise) {
    exercise = row.exercise;
  }
  return {
    id: row.id,
    programWorkoutId: dayId,
    exerciseId: row.exerciseId,
    blockId: null,
    supersetGroupId: row.supersetGroupId,
    orderIndex: row.orderIndex,
    notes: row.notes,
    alternateExerciseId: null,
    exercise,
    sets: row.sets.map((set) => assignedAsPrescribed(set)),
  };
}

/**
 * The copy's day as a program day, for the editor. The copy keeps no rest
 * of its own for the day: assigning wrote the planned rest onto every set,
 * so each exercise shows its own.
 * @Arguments copy
 */
export function copyAsWorkout(copy: CopyDayDetail): ProgramWorkout {
  const day = copy.day;
  return {
    id: day.id,
    programId: copy.assignment.id,
    name: day.name,
    notes: day.notes,
    weekIndex: day.weekIndex,
    dayIndex: day.dayIndex,
    sequenceNumber: 0,
    phase: null,
    estimatedDurationMinutes: null,
    defaultRestSeconds: null,
    createdAt: '',
    updatedAt: '',
    exercises: day.exercises.map((row) => copyExerciseAsPrescribed(row, day.id)),
  };
}
