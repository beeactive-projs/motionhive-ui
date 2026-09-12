import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Program, ProgramService, ProgramWorkout } from 'core';

import { weeksOf } from '../programs.config';

/** One week's worth of days, as the builder renders them. */
export interface WeekCard {
  index: number;
  days: (ProgramWorkout | null)[];
  filled: number;
}

const DAYS_PER_WEEK = 7;
const DEFAULT_WEEKS = 4;

/**
 * One program being authored.
 *
 * The week grid is derived, not stored: `program_workout` rows carry their
 * own `weekIndex`/`dayIndex`, so the cards are a view over them and a day
 * with no row is a rest day rather than a special record. That keeps "clear
 * a day" as a delete instead of a state to maintain.
 */
@Injectable()
export class ProgramBuilderStore {
  private readonly _programService = inject(ProgramService);

  private readonly _program = signal<Program | null>(null);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);
  private readonly _saving = signal(false);

  readonly program = this._program.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly failed = this._failed.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly workouts = computed<ProgramWorkout[]>(() => this._program()?.workouts ?? []);

  /** How many weeks to render: the declared duration, or enough to hold the work. */
  readonly weekCount = computed(() => {
    const program = this._program();
    if (!program) return 0;
    const declared = weeksOf(program);
    const used = this.workouts().reduce((max, w) => Math.max(max, w.weekIndex + 1), 0);
    return Math.max(declared ?? DEFAULT_WEEKS, used, 1);
  });

  readonly weeks = computed<WeekCard[]>(() => {
    const byCell = new Map<string, ProgramWorkout>();
    for (const w of this.workouts()) byCell.set(`${w.weekIndex}:${w.dayIndex}`, w);

    return Array.from({ length: this.weekCount() }, (_, index) => {
      const days = Array.from(
        { length: DAYS_PER_WEEK },
        (_, day) => byCell.get(`${index}:${day}`) ?? null,
      );
      return { index, days, filled: days.filter(Boolean).length };
    });
  });

  /** Total days with work — what the status card counts. */
  readonly filledDays = computed(() => this.workouts().length);

  readonly isPublished = computed(() => this._program()?.status === 'PUBLISHED');

  load(id: string, done?: () => void): void {
    this._loading.set(true);
    this._failed.set(false);
    this._programService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this._program.set(program);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._failed.set(true);
          this._loading.set(false);
          done?.();
        },
      });
  }

  /** Re-read after an edit made on another screen (a day, the settings). */
  refresh(): void {
    const id = this._program()?.id;
    if (id) this.load(id);
  }

  adopt(program: Program): void {
    this._program.set(program);
    this._loading.set(false);
    this._failed.set(false);
  }

  // ─── Days ─────────────────────────────────────────────────────

  /**
   * Put a day at this cell. The name is provisional — the day editor is where
   * it gets a real one — but a blank name would make the row unreadable.
   */
  addDay(weekIndex: number, dayIndex: number, done?: (id: string) => void): void {
    const program = this._program();
    if (!program || this._saving()) return;
    this._saving.set(true);

    this._programService
      .addWorkout(program.id, {
        name: `Day ${dayIndex + 1}`,
        weekIndex,
        dayIndex,
      })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((workout) => {
        this._saving.set(false);
        if (!workout) return;
        this._program.update((p) =>
          p ? { ...p, workouts: [...(p.workouts ?? []), workout] } : p,
        );
        done?.(workout.id);
      });
  }

  clearDay(workoutId: string): void {
    const program = this._program();
    if (!program) return;
    this._program.update((p) =>
      p ? { ...p, workouts: (p.workouts ?? []).filter((w) => w.id !== workoutId) } : p,
    );
    this._programService
      .removeWorkout(program.id, workoutId)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe();
  }

  /**
   * Copy every day of one week into another, with the work inside it.
   *
   * The exercises and their prescribed sets are copied too — a copy that
   * reproduced only the day names would leave a coach re-entering the whole
   * week, which is the job this exists to avoid. There is no server-side
   * copy-week, so the tree is walked here.
   *
   * Days already in the target week are removed first, so repeating a copy
   * is safe rather than additive.
   */
  copyWeek(from: number, to: number, done?: () => void): void {
    const program = this._program();
    if (!program || from === to) {
      done?.();
      return;
    }

    const source = this.workouts().filter((w) => w.weekIndex === from);
    const existing = this.workouts().filter((w) => w.weekIndex === to);
    if (!source.length) {
      done?.();
      return;
    }

    this._saving.set(true);
    void this._runCopy(program.id, source, existing, to, done);
  }

  /**
   * Sequential on purpose: the server assigns `sequenceNumber` and
   * `orderIndex` from insertion order, so racing these would scramble the
   * order of days within the week and of sets within an exercise.
   */
  private async _runCopy(
    programId: string,
    source: ProgramWorkout[],
    existing: ProgramWorkout[],
    to: number,
    done?: () => void,
  ): Promise<void> {
    const settle = <T>(obs: Observable<T>) =>
      firstValueFrom(obs.pipe(take(1), catchError(() => of(null))));

    for (const old of existing) {
      await settle(this._programService.removeWorkout(programId, old.id));
    }

    for (const day of source) {
      const created = await settle(
        this._programService.addWorkout(programId, {
          name: day.name,
          weekIndex: to,
          dayIndex: day.dayIndex,
          notes: day.notes ?? undefined,
          phase: day.phase ?? undefined,
          estimatedDurationMinutes: day.estimatedDurationMinutes ?? undefined,
        }),
      );
      if (!created) continue;

      for (const exercise of day.exercises ?? []) {
        const copiedExercise = await settle(
          this._programService.addExercise(programId, created.id, {
            exerciseId: exercise.exerciseId,
            notes: exercise.notes ?? undefined,
            alternateExerciseId: exercise.alternateExerciseId ?? undefined,
          }),
        );
        if (!copiedExercise) continue;

        for (const set of exercise.sets ?? []) {
          await settle(
            this._programService.addSet(programId, created.id, copiedExercise.id, {
              setType: set.setType,
              targetRepsMin: set.targetRepsMin ?? undefined,
              targetRepsMax: set.targetRepsMax ?? undefined,
              targetWeightKg: set.targetWeightKg ?? undefined,
              targetDurationSeconds: set.targetDurationSeconds ?? undefined,
              targetDistanceMeters: set.targetDistanceMeters ?? undefined,
              targetRpe: set.targetRpe ?? undefined,
              restAfterSeconds: set.restAfterSeconds ?? undefined,
              tempo: set.tempo ?? undefined,
            }),
          );
        }
      }
    }

    this._saving.set(false);
    this.load(programId, done);
  }
}
