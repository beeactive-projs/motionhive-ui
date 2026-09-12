import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { Routine } from 'core';

import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { ClockService } from '../../_shared/services/clock.service';
import { RoutineRow } from './_components/routine-row/routine-row';
import { TodayHero } from './_components/today-hero/today-hero';
import {
  WORKOUT_ICONS,
  elapsedLabel,
  routineTone,
} from './workouts.config';
import { WorkoutsStore } from './workouts.store';

/**
 * The Workouts tab — the trainee's front door to training.
 *
 * Order is deliberate and matches the design: anything already in progress
 * outranks everything, then what a plan says to do today, then the always-
 * available empty-workout on-ramp, then the libraries. A casual user who
 * never opens a plan still has a one-tap way to start.
 */
@Component({
  selector: 'mh-workouts',
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    RoutineRow,
    TodayHero,
  ],
  providers: [WorkoutsStore],
  templateUrl: './workouts.html',
  styleUrl: './workouts.scss',
})
export class Workouts implements ViewWillEnter {
  readonly store = inject(WorkoutsStore);
  private readonly _router = inject(Router);
  private readonly _clock = inject(ClockService);

  readonly skeletonRows = [1, 2, 3];
  readonly routineTone = routineTone;

  /** How long the abandoned session has been open, for the resume banner. */
  readonly elapsed = computed(() => {
    const log = this.store.inProgress();
    return log ? elapsedLabel(log.startedAt, this._clock.now()) : '';
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page in its tab stack, so a plan finished
  // on another screen would otherwise still read as today's work.
  ionViewWillEnter(): void {
    this._clock.bump();
    this.store.load();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this._clock.bump();
    this.store.load({ done: () => void event.target.complete() });
  }

  // ─── Starting ─────────────────────────────────────────────────

  resume(): void {
    const log = this.store.inProgress();
    if (log) void this._router.navigate(['/tabs/workouts/log', log.id]);
  }

  startToday(): void {
    const today = this.store.today() ?? this.store.upNext();
    if (!today) return;
    // The assignment carries the deep-copied tree; the workout id says which
    // day of it to show.
    void this._router.navigate(['/tabs/workouts/preview', today.programAssignmentId], {
      queryParams: { workout: today.assignedWorkoutId },
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

  openExercises(): void {
    void this._router.navigate(['/tabs/workouts/exercises']);
  }

  /**
   * A plan has no page of its own yet (that is the multi-week view, round 2),
   * so it opens at the next thing you would actually do in it — the preview
   * falls back to the first unfinished day when no specific one is named.
   */
  openPlan(planId: string): void {
    void this._router.navigate(['/tabs/workouts/preview', planId]);
  }

  retry(): void {
    this.store.load();
  }
}
