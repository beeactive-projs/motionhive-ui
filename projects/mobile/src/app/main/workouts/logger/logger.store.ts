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

import { DEFAULT_SETS } from '../workouts.config';

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
  private readonly _workoutLogService = inject(WorkoutLogService);

  private readonly _log = signal<WorkoutLog | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _saving = signal(0);

  /**
   * One write in flight per set; changes made meanwhile wait here, merged.
   * Two parallel PATCHes to the same set race on the server: each reply is
   * built from the row as that request read it, so the later-arriving one
   * can carry a stale field and wipe a value the user just typed (ticking a
   * set with the keypad still open did exactly that to its reps).
   */
  private readonly _inFlight = new Set<string>();
  private readonly _queued = new Map<string, { exerciseId: string; payload: LogSetPayload }>();

  readonly log = this._log.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** True while any set write is in flight — drives the quiet saving hint. */
  readonly saving = computed(() => this._saving() > 0);

  readonly showSkeleton = computed(() => this._loading() && !this._log());
  readonly showError = computed(() => this._error() && !this._log());

  readonly exercises = computed<LoggedExercise[]>(() => this._log()?.exercises ?? []);

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
    this._error.set(false);
    this._workoutLogService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this._log.set(log);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._error.set(true);
          this._loading.set(false);
        },
      });
  }

  /** Adopt a log the caller already has — start returns the whole tree. */
  adopt(log: WorkoutLog): void {
    this._log.set(log);
    this._loading.set(false);
    this._error.set(false);
  }

  // ─── Sets ─────────────────────────────────────────────────────

  logSet(exerciseId: string, setId: string, payload: LogSetPayload): void {
    if (!this._log()) return;

    this._patchSet(exerciseId, setId, payload as Partial<LoggedSet>);

    if (this._inFlight.has(setId)) {
      const waiting = this._queued.get(setId);
      this._queued.set(setId, { exerciseId, payload: { ...waiting?.payload, ...payload } });
      return;
    }
    this._sendSet(exerciseId, setId, payload);
  }

  private _sendSet(exerciseId: string, setId: string, payload: LogSetPayload): void {
    const log = this._log();
    if (!log) return;

    this._inFlight.add(setId);
    this._saving.update((n) => n + 1);

    this._workoutLogService
      .logSet(log.id, setId, payload)
      .pipe(
        take(1),
        catchError(() => of(null)),
      )
      .subscribe((saved) => {
        this._saving.update((n) => Math.max(0, n - 1));
        this._inFlight.delete(setId);

        const next = this._queued.get(setId);
        if (next) {
          // The local row already holds these newer edits; this reply would
          // only roll them back. Send them, and take the server's row after.
          this._queued.delete(setId);
          this._sendSet(next.exerciseId, setId, next.payload);
          return;
        }
        if (saved) this._replaceSet(exerciseId, saved);
      });
  }

  addSet(exerciseId: string): void {
    const log = this._log();
    if (!log) return;
    this._workoutLogService
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

  /**
   * Optimistic like every write here, but a failed delete cannot be shrugged
   * off — the row would be gone locally and back on the next load. So a
   * failure re-reads the log and tells the caller.
   */
  removeSet(exerciseId: string, setId: string, onError?: () => void): void {
    const log = this._log();
    if (!log) return;
    // Edits still waiting on an in-flight write would only 404 once it lands.
    this._queued.delete(setId);
    this._updateExercise(exerciseId, (ex) => ({
      ...ex,
      sets: (ex.sets ?? []).filter((s) => s.id !== setId),
    }));
    this._workoutLogService
      .removeSet(log.id, setId)
      .pipe(take(1))
      .subscribe({
        error: () => {
          onError?.();
          this._workoutLogService
            .get(log.id)
            .pipe(take(1), catchError(() => of(null)))
            .subscribe((fresh) => {
              if (fresh) this._log.set(fresh);
            });
        },
      });
  }

  // ─── Exercises ────────────────────────────────────────────────

  setSkipped(exerciseId: string, skipped: boolean): void {
    const log = this._log();
    if (!log) return;
    this._updateExercise(exerciseId, (ex) => ({ ...ex, isSkipped: skipped }));
    this._workoutLogService
      .setExerciseSkipped(log.id, exerciseId, skipped)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((updated) => {
        if (updated) this._updateExercise(exerciseId, () => updated);
      });
  }

  /**
   * The picker commits several at once; the endpoint takes one at a time,
   * so they go in parallel and land in the order the user chose them.
   * `defaultSets` has the server seed the empty sets with each exercise,
   * so it is loggable the moment it appears — one request per movement.
   */
  addExercises(exerciseIds: string[], done?: () => void): void {
    const log = this._log();
    if (!log || !exerciseIds.length) return;

    forkJoin(
      exerciseIds.map((id) =>
        this._workoutLogService
          .addExercise(log.id, id, DEFAULT_SETS)
          .pipe(catchError(() => of(null))),
      ),
    )
      .pipe(take(1))
      .subscribe((added) => {
        if (!added.some(Boolean)) {
          done?.();
          return;
        }
        // Re-read rather than splice: the rows came back in completion
        // order, and their order in the log is the server's to say.
        this._workoutLogService
          .get(log.id)
          .pipe(take(1), catchError(() => of(null)))
          .subscribe((fresh) => {
            if (fresh) this._log.set(fresh);
            done?.();
          });
      });
  }

  swapExercise(exerciseId: string, newExerciseId: string, done?: () => void): void {
    const log = this._log();
    if (!log) return;
    this._workoutLogService
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
    this._workoutLogService
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
