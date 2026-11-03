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
  localDayKey,
} from 'core';

import { plansByDate } from './workouts.config';

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
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _routineService = inject(RoutineService);
  private readonly _workoutLogService = inject(WorkoutLogService);

  private readonly _trainingDay = signal<TrainingDay | null>(null);
  private readonly _routines = signal<Routine[]>([]);
  private readonly _starters = signal<Routine[]>([]);
  private readonly _starterTotal = signal(0);
  /** How many of your routines are archived, for the way back to them. */
  private readonly _archivedTotal = signal(0);
  private readonly _inProgress = signal<WorkoutLog | null>(null);
  /** Counts the list's own patches, so a read begun before one cannot undo it. */
  private _routineEdits = 0;

  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);

  readonly loading = this._loading.asReadonly();

  readonly inProgress = this._inProgress.asReadonly();
  readonly routines = this._routines.asReadonly();
  readonly starters = this._starters.asReadonly();
  /** The whole starter catalogue, for the "See all" count — not just the page we read. */
  readonly starterTotal = this._starterTotal.asReadonly();
  readonly archivedTotal = this._archivedTotal.asReadonly();

  /** What a plan says to do today. Null on a rest day, which is an answer. */
  readonly today = computed<TrainingDayWorkout | null>(
    () => this._trainingDay()?.today ?? null,
  );

  /** By start date, oldest first: the plans under way, then those still to start (`plansByDate`). */
  readonly activePlans = computed<TrainingDayPlan[]>(() =>
    plansByDate(this._trainingDay()?.activePlans ?? []),
  );

  /**
   * The next scheduled day when today is a rest day — so the hero always has
   * something to point at rather than going blank between sessions.
   */
  readonly upNext = computed<TrainingDayWorkout | null>(() => {
    if (this.today()) return null;
    const week = this._trainingDay()?.week ?? [];
    const todayKey = localDayKey(new Date());
    return week.find((w) => !!w.scheduledDate && w.scheduledDate > todayKey) ?? null;
  });

  /** The plan day the hero shows: today's, or the next one on a rest day. */
  readonly heroWorkout = computed(() => this.today() ?? this.upNext());

  /**
   * The open session is the hero's own day, begun earlier and left. The
   * resume banner already is that workout, so the hero steps aside rather
   * than show it twice.
   */
  readonly heroIsOpen = computed(() => {
    const open = this._inProgress();
    const hero = this.heroWorkout();
    return !!open && !!hero && open.assignedWorkoutId === hero.assignedWorkoutId;
  });

  /**
   * Nothing assigned, nothing saved, nothing logged — the cold start. An
   * archived routine was saved, so it keeps the page that holds the way back
   * to the archive.
   */
  readonly isColdStart = computed(
    () =>
      this._loaded() &&
      !this.today() &&
      !this.upNext() &&
      this.activePlans().length === 0 &&
      this._routines().length === 0 &&
      this._archivedTotal() === 0,
  );

  readonly starterPreview = computed(() => this._starters().slice(0, STARTER_PREVIEW_LIMIT));

  /** First load only — a refresh happens under the content already on screen. */
  readonly showSkeleton = computed(() => this._loading() && !this._loaded());

  /** The load-bearing read failed and there is nothing older to show instead. */
  readonly showError = computed(() => this._failed() && !this._trainingDay());

  /** A routine deleted from the list leaves it at once, without a reload. */
  dropRoutine(id: string): void {
    this._routineEdits++;
    this._routines.update((routines) => routines.filter((routine) => routine.id !== id));
  }

  /** An archived one leaves it too, and joins the way back to the archive. */
  moveToArchived(id: string): void {
    this.dropRoutine(id);
    this._archivedTotal.update((total) => total + 1);
  }

  load(opts: { done?: () => void } = {}): void {
    this._loading.set(true);
    // A routine archived or deleted while this read is out was read before
    // the change, so its lists would bring the row back. The patch wins.
    const edits = this._routineEdits;

    forkJoin({
      day: this._programAssignmentService.trainingDay().pipe(catchError(() => of(null))),
      routines: this._routineService
        .list({ library: 'mine', limit: ROUTINE_LIMIT })
        .pipe(catchError(() => of(null))),
      starters: this._routineService
        .list({ library: 'system', limit: ROUTINE_LIMIT })
        .pipe(catchError(() => of(null))),
      archived: this._routineService
        .list({ library: 'mine', archived: 'only', limit: 1 })
        .pipe(catchError(() => of(null))),
      inProgress: this._workoutLogService.getInProgress().pipe(catchError(() => of(null))),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ day, routines, starters, archived, inProgress }) => {
          const current = edits === this._routineEdits;
          if (archived && current) this._archivedTotal.set(archived.total);
          if (day) this._trainingDay.set(day);
          if (routines && current) this._routines.set(routines.items);
          if (starters) {
            this._starters.set(starters.items);
            this._starterTotal.set(starters.total);
          }
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
}
