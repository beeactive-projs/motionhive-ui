import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';

import {
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  WorkoutLogStatus,
  displayName,
  localDayKey,
} from 'core';

/** One week of the plan, as the list renders it. */
export interface PlanWeek {
  index: number;
  days: AssignedWorkout[];
  done: number;
}

/**
 * One assignment, read from the trainee's side.
 *
 * A twelve-week plan is intimidating as a list of thirty-six workouts, so
 * this derives the four answers the page gives in order: where am I, what is
 * today, what is this week, and how much is left. All of it is a view over
 * the assignment's deep-copied tree — nothing here is fetched separately.
 */
@Injectable()
export class PlanStore {
  private readonly _programAssignmentService = inject(ProgramAssignmentService);

  private readonly _assignment = signal<ProgramAssignment | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private _seq = 0;

  readonly assignment = this._assignment.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._assignment());

  readonly showError = computed(() => this._error() && !this._assignment());

  readonly coachName = computed(() => {
    const assignment = this._assignment();
    // Your own scheduled routine has no coach to name, whatever the row's
    // `instructor` says — it is you.
    if (!assignment || assignment.assignmentKind === 'SELF') return null;
    return assignment.instructor ? displayName(assignment.instructor, 'your coach') : null;
  });

  readonly workouts = computed<AssignedWorkout[]>(() => this._assignment()?.workouts ?? []);

  /** Done counts what was actually finished, not what has merely passed. */
  readonly doneCount = computed(
    () => this.workouts().filter((w) => w.status === WorkoutLogStatus.Completed).length,
  );

  readonly totalCount = computed(() => this.workouts().length);

  /** 0–1 for the progress bar. */
  readonly progress = computed(() => {
    const total = this.totalCount();
    return total ? this.doneCount() / total : 0;
  });

  readonly weeks = computed<PlanWeek[]>(() => {
    const byWeek = new Map<number, AssignedWorkout[]>();
    for (const workout of this.workouts()) {
      const bucket = byWeek.get(workout.weekIndex);
      if (bucket) bucket.push(workout);
      else byWeek.set(workout.weekIndex, [workout]);
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, days]) => ({
        index,
        days: days.sort((a, b) => a.dayIndex - b.dayIndex),
        done: days.filter((d) => d.status === WorkoutLogStatus.Completed).length,
      }));
  });

  /** Which week the trainee is actually in — the first with work left. */
  readonly currentWeek = computed(() => {
    const week = this.weeks().find((w) => w.done < w.days.length);
    return week?.index ?? Math.max(0, this.weeks().length - 1);
  });

  readonly thisWeek = computed(
    () => this.weeks().find((w) => w.index === this.currentWeek())?.days ?? [],
  );

  /** What the plan says to do today. Null on a rest day, which is an answer. */
  readonly today = computed<AssignedWorkout | null>(() => {
    const key = localDayKey(new Date());
    return this.workouts().find((w) => w.scheduledDate === key && !w.status) ?? null;
  });

  /** What is coming when today is a rest day, so the page is never blank. */
  readonly upNext = computed<AssignedWorkout | null>(() => {
    if (this.today()) return null;
    const key = localDayKey(new Date());
    return (
      this.workouts()
        .filter((w) => !w.status && w.scheduledDate > key)
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null
    );
  });

  /**
   * Always a fresh read: finishing a workout changes every count on this
   * page, and the page is kept alive in the tab stack between visits.
   */
  load(id: string): void {
    const seq = ++this._seq;
    this._loading.set(true);
    this._error.set(false);

    this._programAssignmentService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (assignment) => {
          if (seq !== this._seq) return;
          this._assignment.set(assignment);
          this._loading.set(false);
        },
        error: () => {
          if (seq !== this._seq) return;
          this._error.set(true);
          this._loading.set(false);
        },
      });
  }
}
