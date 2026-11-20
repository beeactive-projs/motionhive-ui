import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  Program,
  ProgramService,
  ProgramStatus,
  ProgramWorkout,
  workoutExerciseCount,
} from 'core';

import { DAYS_PER_WEEK, DEFAULT_PROGRAM_WEEKS, weeksOf, weeksToDays } from '../programs.config';

/** What the details sheet saves: the program's own fields, not its days. */
export interface ProgramDetailsChange {
  name: string;
  description: string;
  weeks: number;
  /** Fill the weeks a longer program gains by repeating the ones already built. */
  repeatNewWeeks: boolean;
}

/** One week's worth of days, as the builder renders them. */
export interface WeekCard {
  index: number;
  days: (ProgramWorkout | null)[];
  filled: number;
}

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
  private readonly _translateService = inject(TranslateService);

  private readonly _program = signal<Program | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _saving = signal(false);
  /**
   * A day cleared on screen whose delete is held back while its undo is on
   * offer. Only one waits at a time: clearing another sends this one first.
   */
  private readonly _pendingClear = signal<ProgramWorkout | null>(null);

  readonly program = this._program.asReadonly();
  /** The id of the day whose delete is held, or null. */
  readonly pendingClearId = computed(() => {
    const day = this._pendingClear();
    if (!day) {
      return null;
    }
    return day.id;
  });

  constructor() {
    // However the page goes (back, a tab tap, a new program), a held delete
    // is sent rather than lost: the coach saw the day cleared.
    inject(DestroyRef).onDestroy(() => this.flushClear());
  }
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._program());
  readonly showError = computed(() => this._error() && !this._program());

  readonly workouts = computed<ProgramWorkout[]>(() => this._program()?.workouts ?? []);

  /** How many weeks to render: the declared duration, or enough to hold the work. */
  readonly weekCount = computed(() => {
    const program = this._program();
    if (!program) return 0;
    const declared = weeksOf(program);
    const used = this.workouts().reduce((max, w) => Math.max(max, w.weekIndex + 1), 0);
    return Math.max(declared ?? DEFAULT_PROGRAM_WEEKS, used, 1);
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

  /**
   * Days with at least one exercise. A day row with nothing in it is a rest
   * day to a client, so this, not `filledDays`, is what publishing needs.
   */
  readonly exerciseDays = computed(
    () => this.workouts().filter((w) => workoutExerciseCount(w) > 0).length,
  );

  /** Clients of this coach who still follow the program, from the detail read. */
  readonly clientCount = computed(() => {
    const program = this._program();
    if (!program) {
      return 0;
    }
    return program.clientCount ?? 0;
  });

  /** The first day there is, in the order a client meets them. Null when none. */
  readonly firstDay = computed<ProgramWorkout | null>(() => {
    const ordered = [...this.workouts()].sort((a, b) => {
      if (a.weekIndex !== b.weekIndex) {
        return a.weekIndex - b.weekIndex;
      }
      return a.dayIndex - b.dayIndex;
    });
    if (!ordered.length) {
      return null;
    }
    return ordered[0];
  });

  readonly isPublished = computed(() => this._program()?.status === ProgramStatus.Published);

  load(id: string, done?: () => void): void {
    this._loading.set(true);
    this._error.set(false);
    this._programService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this._program.set(this._withoutPendingClear(program));
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._error.set(true);
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
    this._error.set(false);
  }

  // ─── The program itself ───────────────────────────────────────

  /**
   * Name, description and length, from the details sheet.
   *
   * The update answers with the program alone, not its days, so the days
   * already here are kept, minus the weeks a shorter length just dropped (the
   * sheet named them before Save). Repeating into new weeks is a second
   * request on purpose: the length is saved either way, and a failed repeat
   * leaves empty weeks rather than a lost edit. `repeatFailed` says which.
   */
  saveDetails(
    change: ProgramDetailsChange,
    done: (error?: unknown, repeatFailed?: boolean) => void,
  ): void {
    const program = this._program();
    if (!program || this._saving()) return;
    this._saving.set(true);

    this._afterPendingClear(() => this._saveDetails(program, change, done));
  }

  private _saveDetails(
    program: Program,
    change: ProgramDetailsChange,
    done: (error?: unknown, repeatFailed?: boolean) => void,
  ): void {
    this._programService
      .update(program.id, {
        name: change.name,
        description: change.description || undefined,
        durationDays: weeksToDays(change.weeks),
      })
      .pipe(take(1))
      .subscribe({
        next: (saved) => {
          // The days on screen (a held clear stays cleared), minus the weeks
          // a shorter length dropped. The answer carries the program alone,
          // so what only the detail read knows (the client count) is kept.
          const current = this._program() ?? program;
          const kept = (current.workouts ?? []).filter((w) => w.weekIndex < change.weeks);
          this._program.set({ ...current, ...saved, workouts: saved.workouts ?? kept });
          if (!change.repeatNewWeeks) {
            this._saving.set(false);
            done();
            return;
          }
          this._programService
            .repeatWeeks(program.id)
            .pipe(take(1))
            .subscribe({
              next: (full) => {
                this._program.set(full);
                this._saving.set(false);
                done();
              },
              error: (error: unknown) => {
                this._saving.set(false);
                done(error, true);
              },
            });
        },
        error: (error: unknown) => {
          this._saving.set(false);
          done(error);
        },
      });
  }

  /**
   * Draft to published and back. Only the status moves: clients already on
   * the plan keep their own copy, so nothing they see changes.
   */
  setStatus(status: ProgramStatus, done: (error?: unknown) => void): void {
    const program = this._program();
    if (!program || this._saving()) return;
    this._saving.set(true);
    // Publishing is judged on the days the server has, so a held clear lands first.
    this._afterPendingClear(() => this._setStatus(program, status, done));
  }

  private _setStatus(
    program: Program,
    status: ProgramStatus,
    done: (error?: unknown) => void,
  ): void {
    this._programService
      .update(program.id, { status })
      .pipe(take(1))
      .subscribe({
        next: (saved) => {
          this._program.update((current) => (current ? { ...current, status: saved.status } : current));
          this._saving.set(false);
          done();
        },
        error: (error: unknown) => {
          this._saving.set(false);
          done(error);
        },
      });
  }

  /** A copy owned by the caller, as a fresh draft. This program is untouched. */
  duplicate(done: (copy: Program | null, error?: unknown) => void): void {
    const program = this._program();
    if (!program || this._saving()) return;
    this._saving.set(true);
    this._afterPendingClear(() => this._duplicate(program, done));
  }

  private _duplicate(
    program: Program,
    done: (copy: Program | null, error?: unknown) => void,
  ): void {
    this._programService
      .duplicate(program.id)
      .pipe(take(1))
      .subscribe({
        next: (copy) => {
          this._saving.set(false);
          done(copy);
        },
        error: (error: unknown) => {
          this._saving.set(false);
          done(null, error);
        },
      });
  }

  remove(done: (error?: unknown) => void): void {
    const program = this._program();
    if (!program || this._saving()) return;
    this._saving.set(true);
    // Its days go with it, so a held clear has nothing left to delete.
    this._pendingClear.set(null);
    this._programService
      .remove(program.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._saving.set(false);
          done();
        },
        error: (error: unknown) => {
          this._saving.set(false);
          done(error);
        },
      });
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
    // The slot may be the one just cleared: its row must be gone first.
    this._afterPendingClear(() => this._addDay(program, weekIndex, dayIndex, done));
  }

  private _addDay(
    program: Program,
    weekIndex: number,
    dayIndex: number,
    done?: (id: string) => void,
  ): void {
    this._programService
      .addWorkout(program.id, {
        name: this._translateService.instant('programs.common.day', { number: dayIndex + 1 }),
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

  /**
   * Clear a day on screen at once and hold its delete, so it can be undone:
   * `undoClear` puts it back with no request, `flushClear` sends the delete
   * (the undo toast closed, the page left). A day cannot be rebuilt in one
   * request once deleted, so holding the delete is what makes undo cheap.
   * Answers with the day cleared, or null when there was none.
   */
  clearDay(workoutId: string): ProgramWorkout | null {
    const program = this._program();
    if (!program) {
      return null;
    }
    const day = (program.workouts ?? []).find((w) => w.id === workoutId);
    if (!day) {
      return null;
    }
    this.flushClear();
    this._pendingClear.set(day);
    this._program.set({
      ...program,
      workouts: (program.workouts ?? []).filter((w) => w.id !== workoutId),
    });
    return day;
  }

  /** Undo: the day comes back as it was, and its delete is never sent. */
  undoClear(workoutId: string): void {
    const day = this._pendingClear();
    if (!day || day.id !== workoutId) {
      return;
    }
    this._pendingClear.set(null);
    const program = this._program();
    if (!program) {
      return;
    }
    this._program.set({ ...program, workouts: [...(program.workouts ?? []), day] });
  }

  /**
   * Send the held delete, if there is one. With an id, only when it is that
   * day's: a toast closing late must not send a newer clear early.
   */
  flushClear(workoutId?: string): void {
    const day = this._pendingClear();
    if (!day) {
      return;
    }
    if (workoutId !== undefined && day.id !== workoutId) {
      return;
    }
    this._pendingClear.set(null);
    this._sendClear(day).subscribe();
  }

  /**
   * Run a write once a held delete has reached the server. The write may
   * read or fill the same days (a copy, a new day in the cleared slot, the
   * publish check), so it must find that day gone.
   */
  private _afterPendingClear(run: () => void): void {
    const day = this._pendingClear();
    if (!day) {
      run();
      return;
    }
    this._pendingClear.set(null);
    this._sendClear(day).subscribe(() => run());
  }

  /** The delete itself. Silent on failure: the day is already off the screen. */
  private _sendClear(day: ProgramWorkout): Observable<unknown> {
    return this._programService
      .removeWorkout(day.programId, day.id)
      .pipe(take(1), catchError(() => of(null)));
  }

  /** A fresh read still holds a day whose delete is waiting: keep it cleared. */
  private _withoutPendingClear(program: Program): Program {
    const pending = this.pendingClearId();
    if (!pending) {
      return program;
    }
    return { ...program, workouts: (program.workouts ?? []).filter((w) => w.id !== pending) };
  }

  /**
   * Copy every day of one week into other weeks, with the work inside them.
   *
   * One request, however many weeks it goes to. The server copies
   * exercises and sets in a single transaction and replaces whatever the
   * target weeks held, so repeating a copy is idempotent. The earlier walks
   * made one call per row, then one per target week, and tripped the
   * global throttle.
   */
  copyWeek(from: number, to: readonly number[], done?: (error?: unknown) => void): void {
    const program = this._program();
    const targets = [...new Set(to)].filter((week) => week !== from);
    if (!program || !targets.length) {
      done?.();
      return;
    }
    if (!this.workouts().some((w) => w.weekIndex === from)) {
      done?.();
      return;
    }

    this._saving.set(true);
    this._afterPendingClear(() => this._copyWeek(program, from, targets, done));
  }

  private _copyWeek(
    program: Program,
    from: number,
    to: number[],
    done?: (error?: unknown) => void,
  ): void {
    this._programService
      .copyWeek(program.id, from, to)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._saving.set(false);
          this.load(program.id, done);
        },
        error: (error: unknown) => {
          // The program on screen is still fine; only this copy failed.
          this._saving.set(false);
          done?.(error);
        },
      });
  }

  /**
   * Delete one week: its days go, later weeks move up, and the program is
   * a week shorter. One request; the server answers with the new tree.
   */
  deleteWeek(weekIndex: number, done?: (error?: unknown) => void): void {
    const program = this._program();
    if (!program) return;

    this._saving.set(true);
    this._afterPendingClear(() => this._deleteWeek(program, weekIndex, done));
  }

  private _deleteWeek(
    program: Program,
    weekIndex: number,
    done?: (error?: unknown) => void,
  ): void {
    this._applyWeekChange(this._programService.deleteWeek(program.id, weekIndex), done);
  }

  /**
   * An empty week right after this one: later weeks move down one and the
   * program is a week longer. One request; the server answers with the tree.
   */
  insertWeekAfter(weekIndex: number, done?: (error?: unknown) => void): void {
    const program = this._program();
    if (!program || this._saving()) {
      return;
    }
    this._saving.set(true);
    this._afterPendingClear(() =>
      this._applyWeekChange(this._programService.insertWeekAfter(program.id, weekIndex), done),
    );
  }

  /**
   * Clear a week: every day of it goes in one request, and it becomes a week
   * of rest. The weeks keep their places. The server answers with the tree.
   */
  clearWeek(weekIndex: number, done?: (error?: unknown) => void): void {
    const program = this._program();
    if (!program || this._saving()) {
      return;
    }
    this._saving.set(true);
    // The held day may be in this week: it goes first, then the rest.
    this._afterPendingClear(() =>
      this._applyWeekChange(this._programService.clearWeek(program.id, weekIndex), done),
    );
  }

  /** A week-level write the server answers with the program as it now is. */
  private _applyWeekChange(request: Observable<Program>, done?: (error?: unknown) => void): void {
    request.pipe(take(1)).subscribe({
      next: (fresh) => {
        this._saving.set(false);
        this._program.set(fresh);
        done?.();
      },
      error: (error: unknown) => {
        this._saving.set(false);
        done?.(error);
      },
    });
  }

  /**
   * Copy one day into the same slot of several weeks, in one request.
   *
   * Unlike `copyWeek`, the endpoint takes every target at once — so there is
   * no chain of calls to walk, and no half-applied copy if a later week
   * would have failed.
   */
  copyDay(
    fromWeek: number,
    dayIndex: number,
    toWeeks: number[],
    toDayIndex?: number,
    done?: (error?: unknown) => void,
  ): void {
    const program = this._program();
    // A different target day makes the source week a real target too.
    const movingDay = toDayIndex !== undefined && toDayIndex !== dayIndex;
    const targets = toWeeks.filter((w) => movingDay || w !== fromWeek);
    if (!program || !targets.length) {
      done?.();
      return;
    }
    // Nothing in the source slot is nothing to copy.
    if (!this.workouts().some((w) => w.weekIndex === fromWeek && w.dayIndex === dayIndex)) {
      done?.();
      return;
    }

    this._saving.set(true);
    this._afterPendingClear(() =>
      this._copyDay(program, fromWeek, dayIndex, targets, toDayIndex, done),
    );
  }

  private _copyDay(
    program: Program,
    fromWeek: number,
    dayIndex: number,
    targets: number[],
    toDayIndex?: number,
    done?: (error?: unknown) => void,
  ): void {
    this._programService
      .copyDay(program.id, fromWeek, dayIndex, targets, toDayIndex)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._saving.set(false);
          this.load(program.id, done);
        },
        error: (error: unknown) => {
          this._saving.set(false);
          done?.(error);
        },
      });
  }
}
