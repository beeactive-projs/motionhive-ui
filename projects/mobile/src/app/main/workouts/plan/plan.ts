import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  displayName,
  localDayKey,
} from 'core';

import { WORKOUT_ICONS } from '../workouts.config';

/** One week of the plan, as the list renders it. */
interface PlanWeek {
  index: number;
  days: AssignedWorkout[];
  done: number;
}

/**
 * The trainee's side of a multi-week program.
 *
 * A twelve-week plan is intimidating as a list of thirty-six workouts, so
 * this answers four questions in order: where am I, what is today, what is
 * this week, and how much is left. Today's row hands straight off to the
 * preview and then the logger — the same path a single scheduled workout
 * takes, because from here on it is just a workout.
 */
@Component({
  selector: 'mh-plan',
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './plan.html',
  styleUrl: './plan.scss',
})
export class Plan implements ViewWillEnter {
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _router = inject(Router);

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  readonly skeletonRows = [1, 2, 3];

  private _id: string | null = null;

  readonly coachName = computed(() => {
    const instructor = this.assignment()?.instructor;
    return instructor ? displayName(instructor, 'your coach') : null;
  });

  readonly workouts = computed<AssignedWorkout[]>(
    () => this.assignment()?.workouts ?? [],
  );

  /** Done counts what was actually finished, not what has merely passed. */
  readonly doneCount = computed(
    () => this.workouts().filter((w) => w.status === 'COMPLETED').length,
  );

  readonly totalCount = computed(() => this.workouts().length);

  readonly percent = computed(() => {
    const total = this.totalCount();
    return total ? Math.round((this.doneCount() / total) * 100) : 0;
  });

  readonly weeks = computed<PlanWeek[]>(() => {
    const byWeek = new Map<number, AssignedWorkout[]>();
    for (const w of this.workouts()) {
      const bucket = byWeek.get(w.weekIndex);
      if (bucket) bucket.push(w);
      else byWeek.set(w.weekIndex, [w]);
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, days]) => ({
        index,
        days: days.sort((a, b) => a.dayIndex - b.dayIndex),
        done: days.filter((d) => d.status === 'COMPLETED').length,
      }));
  });

  /** Which week the trainee is actually in — the first with work left. */
  readonly currentWeek = computed(() => {
    const week = this.weeks().find((w) => w.done < w.days.length);
    return week?.index ?? Math.max(0, this.weeks().length - 1);
  });

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

  readonly thisWeek = computed(
    () => this.weeks().find((w) => w.index === this.currentWeek())?.days ?? [],
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._router.url.split('?')[0].split('/').pop() ?? null;
    if (!id) return;
    // Always re-read: finishing a workout changes every count on this page.
    this._id = id;
    this.loading.set(true);
    this.failed.set(false);

    this._assignmentService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (assignment) => {
          this.assignment.set(assignment);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  dayLabel(day: AssignedWorkout): string {
    const [y, m, d] = day.scheduledDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  isDone(day: AssignedWorkout): boolean {
    return day.status === 'COMPLETED';
  }

  isSkipped(day: AssignedWorkout): boolean {
    return day.status === 'SKIPPED';
  }

  /** From here on it is just a workout — the same preview the hero uses. */
  open(day: AssignedWorkout): void {
    if (!this._id) return;
    void this._router.navigate(['/tabs/workouts/preview', this._id], {
      queryParams: { workout: day.id },
    });
  }
}
