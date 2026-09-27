import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AssignedWorkout } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { AssignedDayRow } from '../_components/assigned-day-row/assigned-day-row';
import { WORKOUT_ICONS, shortDayLabel } from '../workouts.config';
import { PlanStore } from './plan.store';

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
    AssignedDayRow,
    EmptyState,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SessionRowSkeleton,
  ],
  templateUrl: './plan.html',
  styleUrl: './plan.scss',
  providers: [PlanStore],
})
export class Plan implements ViewWillEnter {
  readonly store = inject(PlanStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3];

  readonly title = computed(() => this.store.assignment()?.programNameSnapshot ?? 'Plan');

  /** "From Alex Dima · Started Mon 1 Sep" — who set it and when it began. */
  readonly fromLine = computed(() => {
    const assignment = this.store.assignment();
    if (!assignment) return '';
    const parts: string[] = [];
    const coach = this.store.coachName();
    if (coach) parts.push(`From ${coach}`);
    parts.push(`Started ${shortDayLabel(assignment.startDate)}`);
    return parts.join(' · ');
  });

  readonly positionLabel = computed(
    () => `Week ${this.store.currentWeek() + 1} of ${this.store.weeks().length}`,
  );

  readonly doneLabel = computed(() => `${this.store.doneCount()} / ${this.store.totalCount()} done`);

  /**
   * Today normally sits inside the current week's rows, where it wears the
   * Start pill. It gets its own section only when it does not — a trainee
   * who is a week behind still has today's work to do today.
   */
  readonly todayApart = computed<AssignedWorkout | null>(() => {
    const today = this.store.today();
    if (!today) return null;
    return this.store.thisWeek().some((day) => day.id === today.id) ? null : today;
  });

  /** What is coming when today is a rest day and the next day is not in view. */
  readonly upNextApart = computed<AssignedWorkout | null>(() => {
    const next = this.store.upNext();
    if (!next) return null;
    return this.store.thisWeek().some((day) => day.id === next.id) ? null : next;
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Always re-read: finishing a workout changes every count on this page,
  // and Ionic keeps the page alive in the stack between visits.
  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  retry(): void {
    this.ionViewWillEnter();
  }

  isToday(day: AssignedWorkout): boolean {
    return this.store.today()?.id === day.id;
  }

  isCurrentWeek(index: number): boolean {
    return index === this.store.currentWeek();
  }

  /** From here on it is just a workout — the same preview the hero uses. */
  open(day: AssignedWorkout): void {
    const assignment = this.store.assignment();
    if (!assignment) return;
    void this._router.navigate(['/tabs/workouts/preview', assignment.id], {
      queryParams: { workout: day.id },
    });
  }
}
