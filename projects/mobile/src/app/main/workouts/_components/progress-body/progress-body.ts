import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  bodyOutline,
  closeOutline,
  flashOutline,
  heartOutline,
  lockClosedOutline,
  mapOutline,
  searchOutline,
  syncOutline,
  timeOutline,
  trendingUpOutline,
  trophyOutline,
} from 'ionicons/icons';
import { take } from 'rxjs/operators';

import {
  ProgressOverview,
  ExerciseKind,
  ProgressRange,
  ProgressService,
  TrainedExercise,
  appLocale,
  formatTotalDuration,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { StatTile } from '../../../../_shared/components/stat-tile/stat-tile';
import { clientPath, coachStackOf } from '../../../clients/client-paths';
import { BadgeTones, KIND_META } from '../../../exercises/exercises.config';
import { formatMeasure, unbreakable } from '../../workouts.config';
import {
  EXERCISES_PAGE,
  latestSetRecord,
  matchingExercises,
  sparkOf,
  trainedExerciseLine,
  trendLabel,
  trendOf,
} from './progress-exercises.config';

/** The window the page reads — twelve weeks is a training block. */
const RANGE: ProgressRange = '12w';

/**
 * Months of volume run to five or six digits: grouped from 10,000 so
 * "49,840" reads at a glance, while a short week's "1200" stays whole.
 */
function groupedVolume(volumeKg: number): string {
  const kg = Math.round(volumeKg);
  return new Intl.NumberFormat(appLocale(), { useGrouping: kg >= 10_000 }).format(kg);
}

/**
 * Progress — the reward for logging, not the reason for it.
 *
 * Three honest numbers and the records, with no composite score and no
 * streak gamification. The design is explicit that this stays light; a
 * training log that starts nagging is one people stop opening.
 *
 * One body for two places: the Progress tab of the trainee's Workouts, and the
 * Progress tab of a client's page when `clientId` is set. The numbers then
 * come from only the workouts that client lets this coach see, so it says
 * that, the way their training does. The host calls `load()` when it shows.
 */
@Component({
  selector: 'mh-progress-body',
  imports: [
    EmptyState,
    HexAvatar,
    IonBadge,
    IonButton,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './progress-body.html',
  styleUrl: './progress-body.scss',
})
export class ProgressBody {
  private readonly _progressService = inject(ProgressService);
  private readonly _translateService = inject(TranslateService);
  private readonly _router = inject(Router);

  /** Whose progress a coach is reading; null on the trainee's own screen. */
  readonly clientId = input<string | null>(null);
  /** Rides along to the exercise page so it can title itself before it loads. */
  readonly clientName = input('');

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
    return [
      {
        label: this._translateService.instant('workouts.tiles.workouts'),
        value: formatMeasure(overview.totals.workouts),
      },
      {
        label: this._translateService.instant('workouts.tiles.volume'),
        value: unbreakable(
          this._translateService.instant('workouts.units.kg', {
            value: groupedVolume(overview.totals.volumeKg),
          }),
        ),
      },
      {
        label: this._translateService.instant('workouts.tiles.time'),
        value: unbreakable(formatTotalDuration(totalMinutes(overview.totals.trainingSeconds))),
      },
    ];
  });

  readonly Tones = BadgeTones;

  /**
   * Every exercise trained, most recent first: lifts, holds and runs alike
   * (the records only ever had the ones with a weight). Read beside the
   * overview; its failure is the list's own, the numbers above still stand.
   */
  readonly exercises = signal<TrainedExercise[]>([]);
  readonly exercisesError = signal(false);
  private readonly _shownExercises = signal(EXERCISES_PAGE);
  /** The search field's words. */
  readonly query = signal('');

  /** A search shows every match; without one, a page at a time. */
  private readonly _matches = computed(() => matchingExercises(this.exercises(), this.query()));

  readonly noMatch = computed(() => !!this.query().trim() && this._matches().length === 0);

  readonly exerciseRows = computed(() => {
    const records = this.overview()?.records ?? [];
    const matches = this._matches();
    return (this.query().trim() ? matches : matches.slice(0, this._shownExercises()))
      .map((exercise) => {
        const trend = trendOf(exercise.recent);
        const meta = KIND_META[exercise.kind as ExerciseKind] ?? KIND_META[ExerciseKind.Strength];
        return {
          id: exercise.exerciseId,
          name: exercise.exerciseName,
          icon: meta.icon,
          tone: meta.tone,
          line: trainedExerciseLine(exercise),
          record: latestSetRecord(exercise, records),
          trend,
          trendLabel: trendLabel(trend, exercise.sessionCount),
          spark: sparkOf(exercise.recent),
        };
      });
  });

  readonly hasMoreExercises = computed(
    () => !this.query().trim() && this.exercises().length > this._shownExercises(),
  );

  constructor() {
    // Its own, since it also sits on a client's page that registers others.
    addIcons({
      alertCircleOutline,
      bodyOutline,
      closeOutline,
      flashOutline,
      heartOutline,
      lockClosedOutline,
      mapOutline,
      searchOutline,
      syncOutline,
      timeOutline,
      trendingUpOutline,
      trophyOutline,
    });
  }

  showMoreExercises(): void {
    this._shownExercises.update((shown) => shown + EXERCISES_PAGE);
  }

  /** The name rides along so the next page can title itself before it loads. */
  openExercise(exerciseId: string, exerciseName: string): void {
    const state = { exerciseName, clientName: this.clientName() };
    const clientId = this.clientId();
    if (clientId) {
      const stack = coachStackOf(this._router.url);
      void this._router.navigate([...clientPath(stack, clientId), 'progress', exerciseId], {
        state,
      });
      return;
    }
    void this._router.navigate(['/tabs/workouts/progress', exerciseId], { state });
  }

  load(): void {
    this.loadExercises();
    this.loading.set(true);
    this.error.set(false);
    const clientId = this.clientId();
    const request = clientId
      ? this._progressService.overviewForClient(clientId, RANGE)
      : this._progressService.overview(RANGE);
    request.pipe(take(1)).subscribe({
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

  loadExercises(): void {
    this.exercisesError.set(false);
    const clientId = this.clientId();
    const request = clientId
      ? this._progressService.trainedExercisesForClient(clientId)
      : this._progressService.trainedExercises({ silent: true });
    request.pipe(take(1)).subscribe({
      next: (exercises) => this.exercises.set(exercises),
      error: () => this.exercisesError.set(true),
    });
  }
}

/**
 * "6h 40m", never decimal hours. Past ten hours, whole hours: minutes are
 * noise in a twelve week total, and "36 h 10 min" does not fit a third of
 * a phone.
 */
function totalMinutes(seconds: number): number {
  const minutes = seconds / 60;
  return minutes >= 600 ? Math.round(minutes / 60) * 60 : minutes;
}
