import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService, dayDividerLabel, localDayKey } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { WORKOUT_ICONS } from '../workouts.config';

const PAGE_SIZE = 25;

/**
 * Everything logged, newest first.
 *
 * Skipped days stay in the list rather than disappearing — a skip was a
 * decision, and a history that hides them reads as a cleaner training record
 * than the one that actually happened.
 */
@Component({
  selector: 'mh-workout-history',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements ViewWillEnter {
  private readonly _logService = inject(WorkoutLogService);
  private readonly _router = inject(Router);

  readonly logs = signal<WorkoutLog[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly total = signal(0);

  private _page = 1;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    if (this.loaded()) return;
    this.load();
  }

  load(): void {
    this._page = 1;
    this.loading.set(true);
    this.failed.set(false);
    this._logService
      .list({ page: 1, limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.logs.set(page.items);
          this.total.set(page.total);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    this._page += 1;
    this._logService
      .list({ page: this._page, limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this.logs.update((rows) => [...rows, ...page.items]);
          void event.target.complete();
        },
        error: () => void event.target.complete(),
      });
  }

  dayLabel(log: WorkoutLog): string {
    return dayDividerLabel(localDayKey(new Date(log.startedAt)));
  }

  duration(log: WorkoutLog): string {
    const seconds = log.durationSeconds;
    if (!seconds) return '';
    const mins = Math.round(seconds / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
  }

  open(log: WorkoutLog): void {
    void this._router.navigate(['/tabs/workouts/finish', log.id]);
  }
}
