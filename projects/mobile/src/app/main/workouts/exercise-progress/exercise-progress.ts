import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { ExerciseProgress as ExerciseProgressData, ProgressRange, ProgressService, appLocale } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { BadgeTones } from '../../exercises/exercises.config';
import { TrendChart, TrendLabel } from '../_components/trend-chart/trend-chart';
import {
  PROGRESS_RANGES,
  WORKOUT_ICONS,
  bestTopSet,
  exerciseSessionLine,
  formatMeasure,
  inRange,
  oneRepMaxDelta,
  oneRepMaxPoints,
  rangeStart,
  recordSessionIds,
  secondsToClock,
  shortDayLabel,
  trendTicks,
} from '../workouts.config';

const DEFAULT_RANGE: ProgressRange = '12w';

/** Direction of the 1RM change, for its colour. */
const Trends = {
  Up: 'up',
  Flat: 'flat',
  Down: 'down',
} as const;

/**
 * One exercise over time: is the estimated 1-rep max going up, a few plain
 * numbers, and every session it appeared in.
 *
 * One request per visit. The API returns the whole history, so switching the
 * range filters what is held instead of asking again.
 */
@Component({
  selector: 'mh-exercise-progress',
  imports: [
    EmptyState,
    IonBackButton,
    IonBadge,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SessionRowSkeleton,
    StatTile,
    TranslatePipe,
    TrendChart,
  ],
  templateUrl: './exercise-progress.html',
  styleUrl: './exercise-progress.scss',
})
export class ExerciseProgress implements ViewWillEnter {
  private readonly _progressService = inject(ProgressService);
  private readonly _translateService = inject(TranslateService);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly ranges = PROGRESS_RANGES;
  readonly Tones = BadgeTones;
  readonly skeletonItems = [1, 2, 3];

  readonly progress = signal<ExerciseProgressData | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);
  readonly range = signal<ProgressRange>(DEFAULT_RANGE);
  /** Pinned per load so every number on the page measures from the same instant. */
  readonly now = signal(Date.now());

  /** The record row's name, so the title is there before the data is. */
  private readonly _stateName =
    (history.state as { exerciseName?: string } | null)?.exerciseName ?? '';

  readonly title = computed(() => this.progress()?.exercise.name ?? this._stateName);

  readonly showSkeleton = computed(() => this.loading() && !this.progress());
  readonly showError = computed(() => this.error() && !this.progress());
  readonly isEmpty = computed(() => this.loaded() && this.progress()?.sessions.length === 0);

  readonly sessions = computed(() =>
    inRange(this.progress()?.sessions ?? [], (s) => s.performedAt, this.range(), this.now()),
  );

  readonly emptyRange = computed(() => this.sessions().length === 0);

  /** Loaded exercises carry a 1RM line; holds, cardio and bodyweight do not. */
  readonly hasSeries = computed(() => (this.progress()?.oneRepMaxSeries.length ?? 0) > 0);

  readonly rangeFrom = computed(() => rangeStart(this.range(), this.now()));

  readonly chartPoints = computed(() =>
    oneRepMaxPoints(this.progress()?.oneRepMaxSeries ?? [], this.range(), this.now()),
  );

  /** The best estimate held at the end of the range — today. */
  readonly heroValue = computed(() => {
    const latest =
      this.chartPoints().at(-1)?.y ?? this.progress()?.oneRepMaxSeries.at(-1)?.weightKg;
    return latest == null
      ? ''
      : this._translateService.instant('workouts.units.kg', { value: formatMeasure(latest, 1) });
  });

  private readonly _delta = computed(() =>
    oneRepMaxDelta(this.progress()?.oneRepMaxSeries ?? [], this.range(), this.now()),
  );

  readonly deltaTrend = computed(() => {
    const delta = this._delta() ?? 0;
    return delta > 0 ? Trends.Up : delta < 0 ? Trends.Down : Trends.Flat;
  });

  /** "+4 kg in 12 weeks". */
  readonly deltaLabel = computed(() => {
    const delta = this._delta();
    if (delta == null) return '';
    return this._translateService.instant('workouts.exerciseProgress.delta', {
      sign: delta > 0 ? '+' : delta < 0 ? '−' : '',
      // Epley estimates are not round numbers; a tenth of a kilo is plenty.
      value: formatMeasure(Math.abs(delta), 1),
      range: this._rangeLabel(this.range()).toLocaleLowerCase(appLocale()),
    });
  });

  readonly chartLabel = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return '';
    return this._translateService.instant('workouts.exerciseProgress.chartLabel', {
      from: formatMeasure(points[0].y, 1),
      to: formatMeasure(points[points.length - 1].y, 1),
    });
  });

  /** Month names under a long range; day and month under four weeks. */
  readonly xLabels = computed<TrendLabel[]>(() => {
    const short = this.range() === '4w';
    const format: Intl.DateTimeFormatOptions = short
      ? { day: 'numeric', month: 'short' }
      : { month: 'short' };
    return trendTicks(this.rangeFrom(), this.now(), short ? 3 : 4).map((at) => ({
      at,
      label: new Date(at).toLocaleDateString(appLocale(), format),
    }));
  });

  readonly tiles = computed(() => {
    const sessions = this.sessions();
    const count = {
      label: this._translateService.instant('workouts.exerciseProgress.sessions'),
      value: formatMeasure(sessions.length),
    };
    const sets = {
      label: this._translateService.instant('workouts.tiles.sets'),
      value: formatMeasure(sessions.reduce((sum, session) => sum + session.setCount, 0)),
    };
    const topSet = bestTopSet(sessions);
    if (topSet) {
      const best = {
        label: this._translateService.instant('workouts.exerciseProgress.bestSet'),
        value: this._translateService.instant('workouts.exerciseProgress.setValue', {
          weight: formatMeasure(topSet.weightKg),
          reps: topSet.reps,
        }),
      };
      return [best, count, sets];
    }
    const best = this._bestValue();
    return best
      ? [
          count,
          sets,
          { label: this._translateService.instant('workouts.exerciseProgress.best'), value: best },
        ]
      : [count, sets];
  });

  readonly sessionRows = computed(() => {
    const progress = this.progress();
    const records = progress ? recordSessionIds(progress) : new Set<string>();
    return this.sessions().map((session) => ({
      id: session.workoutLogId,
      date: shortDayLabel(session.performedAt),
      workout: session.workoutName,
      line: exerciseSessionLine(session),
      record: records.has(session.workoutLogId),
    }));
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  // Always re-read: a workout finished since changes every number here.
  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    const id = this._activatedRoute.snapshot.paramMap.get('exerciseId');
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this._progressService
      .forExercise(id)
      .pipe(take(1))
      .subscribe({
        next: (progress) => {
          this.now.set(Date.now());
          this.progress.set(progress);
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

  setRange(value: unknown): void {
    const range = PROGRESS_RANGES.find((option) => option === value);
    if (range) this.range.set(range);
  }

  openSession(workoutLogId: string): void {
    void this._router.navigate(['/tabs/workouts/finish', workoutLogId]);
  }

  private _rangeLabel(range: ProgressRange): string {
    return this._translateService.instant(`workouts.exerciseProgress.range.${range}`);
  }

  /** The longest hold, furthest distance or most reps in the range. */
  private _bestValue(): string | null {
    const sessions = this.sessions();
    const longest = Math.max(0, ...sessions.map((s) => s.bestDurationSeconds ?? 0));
    if (longest) return secondsToClock(longest);
    const furthest = Math.max(0, ...sessions.map((s) => s.bestDistanceMeters ?? 0));
    if (furthest) {
      return this._translateService.instant('workouts.units.meters', {
        value: formatMeasure(furthest),
      });
    }
    const reps = Math.max(0, ...sessions.map((s) => s.topReps ?? 0));
    return reps ? this._translateService.instant('count.reps', { count: reps }) : null;
  }
}
