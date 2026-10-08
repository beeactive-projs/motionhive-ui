import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  ProgramAssignmentKind,
  Routine,
  TrainingDayPlan,
  WorkoutLogService,
  displayName,
  localDayKey,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { SettingsRow } from '../../_shared/components/settings-row/settings-row';
import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { RoutineRow } from './_components/routine-row/routine-row';
import { TodayHero } from './_components/today-hero/today-hero';
import {
  WORKOUT_ICONS,
  elapsedLabel,
  planWeekLabel,
  routineTileColor,
} from './workouts.config';
import { WorkoutsStore } from './workouts.store';

/** Plans shown before "See all": enough to keep the routines in reach. */
const PLAN_PREVIEW_LIMIT = 3;

/**
 * The Workouts tab — the trainee's front door to training.
 *
 * Order is deliberate and matches the design: anything already in progress
 * outranks everything, then what a plan says to do today, then the
 * empty-workout on-ramp, then the libraries. A casual user who never opens a
 * plan still has a one-tap way to start.
 *
 * One workout at a time: while a session is open, nothing on this page offers
 * to start another. Today's day turns into something to look at, and the
 * empty-workout on-ramp waits until the open session is finished.
 */
@Component({
  selector: 'mh-workouts',
  imports: [
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    RoutineRow,
    SessionRowSkeleton,
    SettingsRow,
    TodayHero,
    TranslatePipe,
  ],
  providers: [WorkoutsStore],
  templateUrl: './workouts.html',
  styleUrl: './workouts.scss',
})
export class Workouts implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(WorkoutsStore);
  private readonly _router = inject(Router);
  private readonly _clockService = inject(ClockService);
  private readonly _translateService = inject(TranslateService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);

  /**
   * The resume banner's clock. It counts live — a running workout must not
   * look paused — but only while this tab is in front and a workout is open:
   * the page lives forever in the tab stack, and the app-wide clock
   * deliberately never ticks (see ClockService).
   */
  private readonly _now = signal(Date.now());
  private readonly _visible = signal(false);

  readonly skeletonRows = [1, 2, 3];
  readonly routineTileColor = routineTileColor;

  /** Every plan, or the first few: a long list would bury the routines. */
  readonly showAllPlans = signal(false);
  readonly visiblePlans = computed(() => {
    const plans = this.store.activePlans();
    return this.showAllPlans() ? plans : plans.slice(0, PLAN_PREVIEW_LIMIT);
  });
  readonly hasHiddenPlans = computed(() => this.store.activePlans().length > PLAN_PREVIEW_LIMIT);

  private readonly _todayKey = computed(() => localDayKey(new Date(this._clockService.now())));

  /** How long the abandoned session has been open, for the resume banner. */
  readonly elapsed = computed(() => {
    const log = this.store.inProgress();
    return log ? elapsedLabel(log.startedAt, this._now()) : '';
  });

  constructor() {
    addIcons(WORKOUT_ICONS);

    effect((onCleanup) => {
      if (!this._visible() || !this.store.inProgress()) return;
      this._now.set(Date.now());
      const handle = setInterval(() => this._now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(handle));
    });
  }

  // Not ngOnInit: Ionic keeps the page in its tab stack, so a plan finished
  // on another screen would otherwise still read as today's work.
  ionViewWillEnter(): void {
    this._clockService.bump();
    this._visible.set(true);
    this.store.load();
  }

  ionViewWillLeave(): void {
    this._visible.set(false);
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this.store.load({ done: () => void event.target.complete() });
  }

  retry(): void {
    this.store.load();
  }

  /** The coach who set the plan, or null for one you scheduled yourself. */
  planCoach(plan: TrainingDayPlan): string | null {
    if (!plan.instructor || plan.assignmentKind === ProgramAssignmentKind.Self) return null;
    return displayName(plan.instructor, this._translateService.instant('workouts.home.yourCoach'));
  }

  /** "Alex Dima · Week 3 of 12" — the coach only when there is one to name. */
  planSubline(plan: TrainingDayPlan): string {
    const coach = this.planCoach(plan);
    const week = planWeekLabel(plan, this._todayKey());
    return coach ? `${coach} · ${week}` : week;
  }

  /** The progress bar's spoken value; the bar itself only shows it. */
  planProgressLabel(plan: TrainingDayPlan): string {
    return this._translateService.instant('workouts.home.percentDone', {
      percent: plan.completionPercent,
    });
  }

  togglePlans(): void {
    this.showAllPlans.update((all) => !all);
  }

  // ─── Starting ─────────────────────────────────────────────────

  resume(): void {
    const log = this.store.inProgress();
    if (log) void this._router.navigate(['/tabs/workouts/log', log.id]);
  }

  openToday(): void {
    const today = this.store.heroWorkout();
    if (!today) return;
    // The assignment carries the deep-copied tree; the workout id says which
    // day of it to show.
    void this._router.navigate(['/tabs/workouts/preview', today.programAssignmentId], {
      queryParams: { workout: today.assignedWorkoutId },
    });
  }

  /** A finished day opens on its summary, which is keyed by the log. */
  openTodaySummary(): void {
    const today = this.store.heroWorkout();
    if (!today) return;
    this._workoutLogService
      .getByAssignedWorkout(today.assignedWorkoutId)
      .pipe(take(1))
      .subscribe({
        next: (log) => void this._router.navigate(['/tabs/workouts/finish', log.id]),
        error: (err) =>
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.todayHero.summaryFailed'),
          ),
      });
  }

  startEmpty(): void {
    void this._router.navigate(['/tabs/workouts/log', 'new']);
  }

  openRoutine(routine: Routine): void {
    void this._router.navigate(['/tabs/workouts/routine', routine.id]);
  }

  // ─── Libraries ────────────────────────────────────────────────

  newRoutine(): void {
    void this._router.navigate(['/tabs/workouts/routine', 'new']);
  }

  openStarters(): void {
    void this._router.navigate(['/tabs/workouts/starters']);
  }

  openHistory(): void {
    void this._router.navigate(['/tabs/workouts/history']);
  }

  openProgress(): void {
    void this._router.navigate(['/tabs/workouts/progress']);
  }

  openExercises(): void {
    void this._router.navigate(['/tabs/workouts/exercises']);
  }

  openPlan(planId: string): void {
    void this._router.navigate(['/tabs/workouts/plan', planId]);
  }
}
