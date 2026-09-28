import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { ProgressOverview, ProgressRange, ProgressService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { WORKOUT_ICONS, formatMeasure } from '../workouts.config';

/** The window the page reads — twelve weeks is a training block. */
const RANGE: ProgressRange = '12w';

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
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class Progress implements ViewWillEnter {
  private readonly _progressService = inject(ProgressService);
  private readonly _translateService = inject(TranslateService);

  readonly overview = signal<ProgressOverview | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);

  readonly skeletonTiles = [1, 2, 3];

  readonly showSkeleton = computed(() => this.loading() && !this.overview());
  readonly showError = computed(() => this.error() && !this.overview());

  readonly isEmpty = computed(
    () => this.loaded() && (this.overview()?.lifetimeWorkouts ?? 0) === 0,
  );

  readonly tiles = computed(() => {
    const overview = this.overview();
    if (!overview) return [];
    const hours = Math.round(overview.totals.trainingSeconds / 360) / 10;
    return [
      {
        label: this._translateService.instant('workouts.tiles.workouts'),
        value: formatMeasure(overview.totals.workouts),
      },
      {
        label: this._translateService.instant('workouts.tiles.volume'),
        value: this._translateService.instant('workouts.units.kg', {
          value: formatMeasure(Math.round(overview.totals.volumeKg)),
        }),
      },
      {
        label: this._translateService.instant('workouts.tiles.time'),
        value: this._translateService.instant('workouts.units.hours', {
          value: formatMeasure(hours, 1),
        }),
      },
    ];
  });

  readonly records = computed(() => this.overview()?.records ?? []);

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  /** "82.5 kg" — a record's weight, in the reader's number format. */
  recordWeight(weightKg: number): string {
    return this._translateService.instant('workouts.units.kg', { value: formatMeasure(weightKg) });
  }

  // Always re-read: a workout finished since changes every number here.
  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this._progressService
      .overview(RANGE)
      .pipe(take(1))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }
}
