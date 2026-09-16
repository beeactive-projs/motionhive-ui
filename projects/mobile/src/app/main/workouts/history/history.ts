import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { WorkoutLog } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { LogRow } from '../_components/log-row/log-row';
import { WORKOUT_ICONS } from '../workouts.config';
import { HistoryStore } from './history.store';

/**
 * Everything logged, newest first.
 *
 * Skipped days stay in the list rather than disappearing — a skip was a
 * decision, and a history that hides them reads as a cleaner training record
 * than the one that actually happened. Repeat is first-class on every done
 * row: it is the fastest route to a second workout.
 */
@Component({
  selector: 'mh-workout-history',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LogRow,
    SessionRowSkeleton,
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  providers: [HistoryStore],
})
export class History implements ViewWillEnter {
  readonly store = inject(HistoryStore);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the stack, and a workout
  // finished since belongs at the top. The store re-reads the loaded window
  // in place, so the scroll holds.
  ionViewWillEnter(): void {
    this.store.refresh();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  open(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/workouts/finish', log.id]);
  }

  /**
   * Do that one again.
   *
   * Starts a fresh freestyle workout carrying the same movements, rather
   * than re-opening the original or minting a routine on the way past: the
   * plan day this came from was scheduled for a date already gone, and a
   * routine per repeat would silently fill the library with near-duplicates.
   */
  repeat(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/workouts/log', 'new'], {
      queryParams: { from: log.id },
    });
  }
}
