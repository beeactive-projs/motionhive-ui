import { Injectable, computed, inject, signal } from '@angular/core';
import { of } from 'rxjs';
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
   * One request. The server copies exercises and sets in a single
   * transaction and replaces whatever the target week held, so repeating
   * a copy is idempotent. The earlier client-side walk made one call per
   * row — ~36 for a modest week — and tripped the global throttle the
   * second time round.
   */
  copyWeek(from: number, to: number, done?: (error?: unknown) => void): void {
    const program = this._program();
    if (!program || from === to) {
      done?.();
      return;
    }
    if (!this.workouts().some((w) => w.weekIndex === from)) {
      done?.();
      return;
    }

    this._saving.set(true);
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
}
