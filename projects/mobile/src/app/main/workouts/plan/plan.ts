import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { AssignedWorkout } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { AssignedDayRow } from '../_components/assigned-day-row/assigned-day-row';
import { WORKOUT_ICONS, WorkoutTabs, shortDayLabel } from '../workouts.config';
import { PlanStatusActions, messageCoachLabel } from './plan-status.config';
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
    IonBadge,
    IonButton,
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
    TranslatePipe,
  ],
  templateUrl: './plan.html',
  styleUrl: './plan.scss',
  providers: [PlanStore],
})
export class Plan implements ViewWillEnter {
  readonly store = inject(PlanStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly skeletonRows = [1, 2, 3];
  readonly StatusActions = PlanStatusActions;

  /** "Message Andrei" on a paused plan's card. */
  readonly messageLabel = computed(() => messageCoachLabel(this.store.coachFirst()));

  /** "From Andrei" over the coach's words. */
  readonly coachMessageLabel = computed(() => {
    let coach = this.store.coachFirst();
    if (!coach) {
      coach = this._translateService.instant('workouts.plan.yourCoach');
    }
    return this._translateService.instant('workouts.planStatus.coachMessage', { coach });
  });

  readonly title = computed(
    () =>
      this.store.assignment()?.programNameSnapshot ??
      this._translateService.instant('workouts.plan.title'),
  );

  /** "From Alex Dima · Started Mon 1 Sep" — who set it and when it began. */
  readonly fromLine = computed(() => {
    const assignment = this.store.assignment();
    if (!assignment) return '';
    const coach = this.store.coachName();
    const date = shortDayLabel(assignment.startDate);
    return coach
      ? this._translateService.instant('workouts.plan.fromCoachStarted', { coach, date })
      : this._translateService.instant('workouts.plan.started', { date });
  });

  readonly positionLabel = computed(() =>
    this._translateService.instant('workouts.plan.position', {
      week: this.store.currentWeek() + 1,
      total: this.store.weeks().length,
    }),
  );

  readonly doneLabel = computed(() =>
    this._translateService.instant('workouts.plan.doneCount', {
      done: this.store.doneCount(),
      total: this.store.totalCount(),
    }),
  );

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

  /** A paused plan waits on the coach: the conversation with them. */
  messageCoach(): void {
    const coach = this.store.assignment()?.instructor;
    if (coach) {
      this._openDirectMessage(coach);
    }
  }

  /** The finished workouts stay in the history; that is where they are. */
  openHistory(): void {
    void this._router.navigate(['/tabs/workouts'], {
      queryParams: { tab: WorkoutTabs.History },
    });
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
