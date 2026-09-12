import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
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
   * Copy every day of one week into another, which is the single biggest
   * time-saver in authoring — most blocks repeat a week with the loads moved.
   * Days already in the target week are replaced, so repeating a copy is safe.
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
    const clears = existing.map((w) =>
      this._programService.removeWorkout(program.id, w.id).pipe(catchError(() => of(null))),
    );

    // Sequential rather than parallel: the server assigns `sequenceNumber`,
    // and racing the writes would scramble the order within the week.
    const run = async () => {
      for (const clear of clears) await firstValueFrom(clear.pipe(take(1)));
      for (const day of source) {
        await firstValueFrom(
          this._programService
            .addWorkout(program.id, {
              name: day.name,
              weekIndex: to,
              dayIndex: day.dayIndex,
              notes: day.notes ?? undefined,
            })
            .pipe(take(1), catchError(() => of(null))),
        );
      }
      this._saving.set(false);
      this.load(program.id, done);
    };
    void run();
  }
}
