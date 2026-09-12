import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  LogSetPayload,
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

/**
 * How many empty sets a freshly added exercise starts with. The API creates
 * the exercise row and no sets, which leaves a header with nothing under it
 * and a tap needed before you can log anything. Three is the consensus
 * default across the trackers this was researched against.
 */
const DEFAULT_SETS = 3;

/**
 * One live workout.
 *
 * Every mutation is optimistic against the server's copy: the grid must feel
 * instant with a phone on gym wifi, and a set that fails to save is worth a
 * toast, not a rollback that erases what the user just did. The server's row
 * replaces the local one when it answers.
 */
@Injectable()
export class LoggerStore {
  private readonly _logService = inject(WorkoutLogService);

  private readonly _log = signal<WorkoutLog | null>(null);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);
  private readonly _saving = signal(0);

  readonly log = this._log.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly failed = this._failed.asReadonly();
  /** True while any set write is in flight — drives the quiet saving hint. */
  readonly saving = computed(() => this._saving() > 0);

  readonly exercises = computed<LoggedExercise[]>(
    () => this._log()?.exercises ?? [],
  );

  /** Skipped exercises leave the denominator; they were a decision, not work. */
  readonly progress = computed(() => {
    const live = this.exercises().filter((e) => !e.isSkipped);
    const sets = live.flatMap((e) => e.sets ?? []);
    const done = sets.filter((s) => s.isCompleted).length;
    return { done, total: sets.length };
  });

  readonly allDone = computed(() => {
    const { done, total } = this.progress();
    return total > 0 && done === total;
  });

  load(id: string, done?: () => void): void {
    this._loading.set(true);
    this._failed.set(false);
    this._logService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this._log.set(log);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._failed.set(true);
          this._loading.set(false);
        },
      });
  }

  /** Adopt a log the caller already has — start returns the whole tree. */
  adopt(log: WorkoutLog): void {
    this._log.set(log);
    this._loading.set(false);
    this._failed.set(false);
  }

  // ─── Sets ─────────────────────────────────────────────────────

  logSet(exerciseId: string, setId: string, payload: LogSetPayload): void {
    const log = this._log();
    if (!log) return;

    this._patchSet(exerciseId, setId, payload as Partial<LoggedSet>);
    this._saving.update((n) => n + 1);

    this._logService
      .logSet(log.id, setId, payload)
      .pipe(
        take(1),
        catchError(() => of(null)),
      )
      .subscribe((saved) => {
        this._saving.update((n) => Math.max(0, n - 1));
        if (saved) this._replaceSet(exerciseId, saved);
      });
  }

  addSet(exerciseId: string): void {
    const log = this._log();
    if (!log) return;
    this._logService
      .addSet(log.id, exerciseId)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((set) => {
        if (!set) return;
        this._updateExercise(exerciseId, (ex) => ({
          ...ex,
          sets: [...(ex.sets ?? []), set],
        }));
      });
  }

  // ─── Exercises ────────────────────────────────────────────────

  setSkipped(exerciseId: string, skipped: boolean): void {
    const log = this._log();
    if (!log) return;
    this._updateExercise(exerciseId, (ex) => ({ ...ex, isSkipped: skipped }));
    this._logService
      .setExerciseSkipped(log.id, exerciseId, skipped)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated) this._updateExercise(exerciseId, () => updated);
      });
  }

  /**
   * The picker commits several at once; the endpoint takes one at a time, so
   * they go in parallel and land in the order the user chose them.
   */
  addExercises(exerciseIds: string[], done?: () => void): void {
    const log = this._log();
    if (!log || !exerciseIds.length) return;

    forkJoin(
      exerciseIds.map((id) =>
        this._logService.addExercise(log.id, id).pipe(catchError(() => of(null))),
      ),
    )
      .pipe(take(1))
      .subscribe((added) => {
        const kept = added.filter((e): e is LoggedExercise => !!e);
        if (!kept.length) {
          done?.();
          return;
        }

        this._updateLog((l) => ({
          ...l,
          exercises: [...(l.exercises ?? []), ...kept],
        }));

        // Seed the empty sets the API does not create, so the exercise is
        // loggable the moment it appears rather than after three more taps.
        forkJoin(
          kept.flatMap((exercise) =>
            Array.from({ length: DEFAULT_SETS }, () =>
              this._logService
                .addSet(log.id, exercise.id)
                .pipe(catchError(() => of(null))),
            ),
          ),
        )
          .pipe(take(1))
          .subscribe(() => {
            // Re-read rather than splice: the sets came back in completion
            // order, and their order in the exercise is the server's to say.
            this._logService
              .get(log.id)
              .pipe(take(1), catchError(() => of(null)))
              .subscribe((fresh) => {
                if (fresh) this._log.set(fresh);
                done?.();
              });
          });
      });
  }

  swapExercise(exerciseId: string, newExerciseId: string, done?: () => void): void {
    const log = this._log();
    if (!log) return;
    this._logService
      .swapExercise(log.id, exerciseId, newExerciseId)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((swapped) => {
        if (swapped) this._updateExercise(exerciseId, () => swapped);
        done?.();
      });
  }

  removeExercise(exerciseId: string): void {
    const log = this._log();
    if (!log) return;
    this._updateLog((l) => ({
      ...l,
      exercises: (l.exercises ?? []).filter((e) => e.id !== exerciseId),
    }));
    this._logService
      .removeExercise(log.id, exerciseId)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe();
  }

  // ─── Local tree helpers ───────────────────────────────────────

  private _updateLog(fn: (log: WorkoutLog) => WorkoutLog): void {
    const log = this._log();
    if (log) this._log.set(fn(log));
  }

  private _updateExercise(
    exerciseId: string,
    fn: (ex: LoggedExercise) => LoggedExercise,
  ): void {
    this._updateLog((log) => ({
      ...log,
      exercises: (log.exercises ?? []).map((e) => (e.id === exerciseId ? fn(e) : e)),
    }));
  }

  private _patchSet(exerciseId: string, setId: string, patch: Partial<LoggedSet>): void {
    this._updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    }));
  }

  private _replaceSet(exerciseId: string, saved: LoggedSet): void {
    this._updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: (ex.sets ?? []).map((s) => (s.id === saved.id ? saved : s)),
    }));
  }
}
