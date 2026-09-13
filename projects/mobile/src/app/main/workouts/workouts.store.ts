import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ProgramAssignmentService,
  Routine,
  RoutineService,
  TrainingDay,
  TrainingDayPlan,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

/** Enough starters to fill the cold-start rail; the rest live behind "See all". */
const STARTER_PREVIEW_LIMIT = 3;
const ROUTINE_LIMIT = 50;

/**
 * The Workouts front door.
 *
 * Three independent reads, because the backend splits them that way and each
 * answers a different question: `trainingDay` is what a plan says to do today,
 * `routines` is what you have saved, and `inProgress` is whether you walked
 * away mid-session. Only the first is allowed to fail loudly — a missing
 * routine list should not blank a page whose hero loaded fine.
 */
@Injectable()
export class WorkoutsStore {
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _routineService = inject(RoutineService);
  private readonly _logService = inject(WorkoutLogService);

  private readonly _trainingDay = signal<TrainingDay | null>(null);
  private readonly _routines = signal<Routine[]>([]);
  private readonly _starters = signal<Routine[]>([]);
  private readonly _inProgress = signal<WorkoutLog | null>(null);

  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly hasLoaded = this._loaded.asReadonly();
  readonly failed = this._failed.asReadonly();

  readonly inProgress = this._inProgress.asReadonly();
  readonly routines = this._routines.asReadonly();
  readonly starters = this._starters.asReadonly();

  /** What a plan says to do today. Null on a rest day, which is an answer. */
  readonly today = computed<TrainingDayWorkout | null>(
    () => this._trainingDay()?.today ?? null,
  );

  readonly activePlans = computed<TrainingDayPlan[]>(
    () => this._trainingDay()?.activePlans ?? [],
  );

  /**
   * The next scheduled day when today is a rest day — so the hero always has
   * something to point at rather than going blank between sessions.
   */
  readonly upNext = computed<TrainingDayWorkout | null>(() => {
    if (this.today()) return null;
    const week = this._trainingDay()?.week ?? [];
    const todayKey = new Date().toISOString().slice(0, 10);
    return week.find((w) => !!w.scheduledDate && w.scheduledDate > todayKey) ?? null;
  });

  /** Nothing assigned, nothing saved, nothing logged — the 6b cold start. */
  readonly isColdStart = computed(
    () =>
      this._loaded() &&
      !this.today() &&
      !this.upNext() &&
      this.activePlans().length === 0 &&
      this._routines().length === 0,
  );

  readonly starterPreview = computed(() => this._starters().slice(0, STARTER_PREVIEW_LIMIT));

  /** First load only — a refresh happens under the content already on screen. */
  readonly showSkeleton = computed(() => this._loading() && !this._loaded());

  load(opts: { done?: () => void } = {}): void {
    this._loading.set(true);

    forkJoin({
      day: this._assignmentService.trainingDay().pipe(catchError(() => of(null))),
      routines: this._routineService
        .list({ library: 'mine', limit: ROUTINE_LIMIT })
        .pipe(catchError(() => of(null))),
      starters: this._routineService
        .list({ library: 'system', limit: ROUTINE_LIMIT })
        .pipe(catchError(() => of(null))),
      inProgress: this._logService.getInProgress().pipe(catchError(() => of(null))),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ day, routines, starters, inProgress }) => {
          this._trainingDay.set(day);
          if (routines) this._routines.set(routines.items);
          if (starters) this._starters.set(starters.items);
          this._inProgress.set(inProgress);

          // Only the plan read is load-bearing for the page's shape.
          this._failed.set(day === null);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        error: () => {
          this._failed.set(true);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }

  /** Drop a resumed or discarded log without refetching the whole page. */
  clearInProgress(): void {
    this._inProgress.set(null);
  }
}
