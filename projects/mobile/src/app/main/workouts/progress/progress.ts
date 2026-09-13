import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { ProgressOverview, ProgressService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { WORKOUT_ICONS } from '../workouts.config';

/**
 * Progress — the reward for logging, not the reason for it.
 *
 * Three honest numbers and the records, with no composite score and no
 * streak gamification. The design is explicit that this stays light; a
 * training log that starts nagging is one people stop opening.
 */
@Component({
  selector: 'mh-workout-progress',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    StatTile,
  ],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class Progress implements ViewWillEnter {
  private readonly _progressService = inject(ProgressService);

  readonly overview = signal<ProgressOverview | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly skeletonRows = [1, 2, 3];

  readonly isEmpty = computed(() => (this.overview()?.lifetimeWorkouts ?? 0) === 0);

  readonly tiles = computed(() => {
    const o = this.overview();
    if (!o) return [];
    const hours = Math.round(o.totals.trainingSeconds / 360) / 10;
    return [
      { label: 'Workouts', value: String(o.totals.workouts) },
      { label: 'Volume', value: `${Math.round(o.totals.volumeKg)} kg` },
      { label: 'Time', value: `${hours} h` },
    ];
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    if (this.loaded()) return;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this._progressService
      .overview('12w')
      .pipe(take(1))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
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
}
