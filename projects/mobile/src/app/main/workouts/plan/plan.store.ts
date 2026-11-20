import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import {
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentKind,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  WorkoutLogStatus,
  displayName,
  localDayKey,
} from 'core';

import { assignmentChip } from '../../programs/programs.config';
import {
  PlanStatusAction,
  coachFirstName,
  planStatusAction,
  planStatusLine,
} from './plan-status.config';

/** One week of the plan, as the list renders it. */
export interface PlanWeek {
  index: number;
  days: AssignedWorkout[];
  /** Days trained, the week's count. */
  done: number;
  /** Days dealt with: trained or skipped. */
  settled: number;
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
  private readonly _translateService = inject(TranslateService);

  private readonly _assignment = signal<ProgramAssignment | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private _seq = 0;

  readonly assignment = this._assignment.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._assignment());

  readonly showError = computed(() => this._error() && !this._assignment());

  /** The coach's note on this plan, when a coach gave it and wrote one. */
  readonly coachNote = computed(() => {
    const assignment = this._assignment();
    if (!assignment || !this.coachName()) {
      return null;
    }
    const note = assignment.notes?.trim();
    if (!note) {
      return null;
    }
    return note;
  });

  readonly coachName = computed(() => {
    const assignment = this._assignment();
    // Your own scheduled routine has no coach to name, whatever the row's
    // `instructor` says — it is you.
    if (!assignment || assignment.assignmentKind === ProgramAssignmentKind.Self) return null;
    if (!assignment.instructor) return null;
    return displayName(
      assignment.instructor,
      this._translateService.instant('workouts.plan.yourCoach'),
    );
  });

  readonly workouts = computed<AssignedWorkout[]>(() => this._assignment()?.workouts ?? []);

  /**
   * Running or waiting to start: its days can be started. A paused,
   * finished or cancelled plan only shows them.
   */
  readonly isRunning = computed(() => {
    const status = this._assignment()?.status;
    return status === ProgramAssignmentStatus.Active || status === ProgramAssignmentStatus.Pending;
  });

  /** The coach's first name for the status card; null for your own plan. */
  readonly coachFirst = computed(() => {
    const assignment = this._assignment();
    if (!assignment || assignment.assignmentKind === ProgramAssignmentKind.Self) {
      return null;
    }
    return coachFirstName(assignment.instructor);
  });

  /** The coach made the last change, rather than the plan finishing on its own. */
  private readonly _changedByCoach = computed(() => {
    const assignment = this._assignment();
    if (!assignment?.statusChangedBy) {
      return false;
    }
    return assignment.statusChangedBy === assignment.instructorId;
  });

  /** Paused, Completed or Cancelled, as the rows on the coach's side say it. */
  readonly statusChip = computed(() => {
    const assignment = this._assignment();
    if (!assignment || this.isRunning()) {
      return null;
    }
    return assignmentChip(assignment.status);
  });

  /**
   * "Paused since 19 Nov. Andrei resumes it when it's time…": what
   * happened to a stopped plan. Null while it runs.
   */
  readonly statusLine = computed(() => {
    const assignment = this._assignment();
    if (!assignment) {
      return null;
    }
    let coach = this.coachFirst();
    if (!coach) {
      coach = this._translateService.instant('workouts.home.yourCoach');
    }
    return planStatusLine({
      status: assignment.status,
      statusChangedAt: assignment.statusChangedAt,
      byCoach: this._changedByCoach(),
      completionPercent: assignment.completionPercent,
      workoutsDone: this.doneCount(),
      coach: coach ?? '',
    });
  });

  /** The coach's words with the change, shown as written. */
  readonly statusMessage = computed(() => {
    const assignment = this._assignment();
    if (!assignment || this.isRunning() || !this._changedByCoach()) {
      return null;
    }
    const message = assignment.statusMessage?.trim();
    if (!message) {
      return null;
    }
    return message;
  });

  /** Write to the coach, or see what was done; none while it runs. */
  readonly statusAction = computed<PlanStatusAction | null>(() => {
    const assignment = this._assignment();
    if (!assignment) {
      return null;
    }
    return planStatusAction(assignment.status);
  });

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
        settled: days.filter(
          (d) => d.status === WorkoutLogStatus.Completed || d.status === WorkoutLogStatus.Skipped,
        ).length,
      }));
  });

  /**
   * Which week the trainee is actually in: the first with a day neither
   * trained nor skipped. A skipped day is dealt with, so one skip (the
   * nightly auto-skip too) never pins "This week" to an old week.
   */
  readonly currentWeek = computed(() => {
    const week = this.weeks().find((w) => w.settled < w.days.length);
    if (week) {
      return week.index;
    }
    // Every day dealt with: the last week, by its own index.
    return this.weeks().at(-1)?.index ?? 0;
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
