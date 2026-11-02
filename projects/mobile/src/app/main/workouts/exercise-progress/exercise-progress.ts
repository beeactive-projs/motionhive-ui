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

import {
  ExerciseProgress as ExerciseProgressData,
  ProgressRange,
  ProgressService,
  VolumeUnits,
  appLocale,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SessionRowSkeleton } from '../../../_shared/components/session-row-skeleton/session-row-skeleton';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { clientUrl, coachStackOf } from '../../clients/client-paths';
import { workoutLinks } from '../../home/home-stack.config';
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
  monthTicks,
  trendTicks,
  sessionTopValue,
  unbreakable,
} from '../workouts.config';
import {
  ExerciseMetric,
  ExerciseMetrics,
  axisValue,
  exerciseMetrics,
  formatPercentChange,
  formatVolume,
  formatVolumeChange,
  pointsChangePercent,
  recordDayLabel,
  recordStillSince,
  topSetPoints,
  topSetUnit,
  volumePoints,
  volumeUnitOf,
} from '../volume.config';

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

  /**
   * Set when a coach reads one client's history of this exercise (mounted
   * under Clients and Programs); null on the trainee's own screen.
   */
  private readonly _clientId = this._activatedRoute.snapshot.paramMap.get('clientId');
  private readonly _stack = coachStackOf(this._router.url);
  /** The trainee's own pages: in Home's stack (from a record) or the Workouts tab's. */
  private readonly _workoutLinks = workoutLinks(this._router.url);

  /**
   * Back on a cold load: the Progress this was opened from, a client's tab
   * or your own page; Home, for a record opened from Latest.
   */
  readonly backHref = this._clientId
    ? `${clientUrl(this._stack, this._clientId)}?tab=progress`
    : this._workoutLinks.progressBack;

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

  /**
   * Whose numbers a coach is reading, carried in from their Progress tab.
   * A cold load has no name to show, and the page stands without it.
   */
  readonly clientName = this._clientId
    ? ((history.state as { clientName?: string } | null)?.clientName ?? '')
    : '';

  readonly title = computed(() => this.progress()?.exercise.name ?? this._stateName);

  readonly showSkeleton = computed(() => this.loading() && !this.progress());
  readonly showError = computed(() => this.error() && !this.progress());
  readonly isEmpty = computed(() => this.loaded() && this.progress()?.sessions.length === 0);

  readonly sessions = computed(() =>
    inRange(this.progress()?.sessions ?? [], (s) => s.performedAt, this.range(), this.now()),
  );

  readonly emptyRange = computed(() => this.sessions().length === 0);

  readonly Metrics = ExerciseMetrics;

  /**
   * What the chart can show: the estimated 1RM for a loaded lift, the top
   * set (or the best, for a hold or a run), and the volume per session.
   */
  readonly metrics = computed(() => {
    const progress = this.progress();
    return progress ? exerciseMetrics(progress) : [];
  });

  private readonly _pickedMetric = signal<ExerciseMetric | null>(null);

  /** The picked metric while it applies, else the first this exercise has. */
  readonly metric = computed<ExerciseMetric | null>(() => {
    const picked = this._pickedMetric();
    const metrics = this.metrics();
    return picked && metrics.includes(picked) ? picked : (metrics[0] ?? null);
  });

  /** The top set's unit: kilograms for a lift, else the hold, distance or reps. */
  private readonly _topSetUnit = computed(() => topSetUnit(this.progress()?.sessions ?? []));

  private readonly _volumeUnit = computed(() => volumeUnitOf(this.progress()?.sessions ?? []));

  /** The switch's options, labelled for this exercise ("Best" for a hold). */
  readonly metricOptions = computed(() =>
    this.metrics().map((metric) => ({
      value: metric,
      label:
        metric === ExerciseMetrics.TopSet && this._topSetUnit() !== VolumeUnits.Kg
          ? 'workouts.volume.exercise.metric.best'
          : `workouts.volume.exercise.metric.${metric}`,
    })),
  );


  readonly rangeFrom = computed(() => rangeStart(this.range(), this.now()));

  readonly chartPoints = computed(() => {
    const progress = this.progress();
    if (!progress) return [];
    switch (this.metric()) {
      case ExerciseMetrics.OneRepMax:
        return oneRepMaxPoints(progress.oneRepMaxSeries, this.range(), this.now());
      case ExerciseMetrics.TopSet: {
        const unit = this._topSetUnit();
        return unit ? topSetPoints(progress.sessions, unit, this.range(), this.now()) : [];
      }
      case ExerciseMetrics.Volume:
        return volumePoints(progress.sessions, this.range(), this.now());
      default:
        return [];
    }
  });

  /** The unit the chart's values are in, for its axis. */
  private readonly _chartUnit = computed(() => {
    switch (this.metric()) {
      case ExerciseMetrics.TopSet:
        return this._topSetUnit();
      case ExerciseMetrics.Volume:
        return this._volumeUnit();
      default:
        return VolumeUnits.Kg;
    }
  });

  readonly formatTick = computed(() => {
    const unit = this._chartUnit();
    return (value: number) => axisValue(value, unit);
  });

  /**
   * The figure leading the card: the best estimate held today, the latest
   * session's top set ("62.5 kg × 8"), or its volume ("4,280 kg").
   */
  readonly heroValue = computed(() => {
    const metric = this.metric();
    if (metric === ExerciseMetrics.OneRepMax) {
      const latest =
        this.chartPoints().at(-1)?.y ?? this.progress()?.oneRepMaxSeries.at(-1)?.weightKg;
      return latest == null
        ? ''
        : this._translateService.instant('workouts.units.kg', { value: formatMeasure(latest, 1) });
    }
    const latest = this.chartPoints().at(-1)?.y;
    const unit = this._chartUnit();
    if (latest == null || !unit) return '';
    if (metric === ExerciseMetrics.TopSet && unit === VolumeUnits.Kg) {
      const session = this.sessions()[0];
      return session ? sessionTopValue(session) : '';
    }
    return formatVolume(latest, unit);
  });

  /** How far the line moved across the range; null when it has no span. */
  private readonly _delta = computed(() => {
    if (this.metric() === ExerciseMetrics.OneRepMax) {
      return oneRepMaxDelta(this.progress()?.oneRepMaxSeries ?? [], this.range(), this.now());
    }
    const points = this.chartPoints();
    if (points.length < 2) return null;
    if (this.metric() === ExerciseMetrics.Volume) return pointsChangePercent(points);
    return Math.round((points[points.length - 1].y - points[0].y) * 100) / 100;
  });

  readonly deltaTrend = computed(() => {
    const delta = this._delta() ?? 0;
    return delta > 0 ? Trends.Up : delta < 0 ? Trends.Down : Trends.Flat;
  });

  /** "+4 kg in 12 weeks", "+12% in 12 weeks", "+0:15 in 4 weeks". */
  readonly deltaLabel = computed(() => {
    const delta = this._delta();
    if (delta == null) return '';
    const range = this._rangeLabel(this.range()).toLocaleLowerCase(appLocale());
    const metric = this.metric();
    const unit = this._chartUnit() ?? VolumeUnits.Reps;
    if (metric === ExerciseMetrics.Volume) {
      return this._translateService.instant('workouts.volume.deltaIn', {
        change: formatPercentChange(delta),
        range,
      });
    }
    if (unit === VolumeUnits.Kg) {
      return this._translateService.instant('workouts.exerciseProgress.delta', {
        sign: delta > 0 ? '+' : delta < 0 ? '−' : '',
        // Epley estimates are not round numbers; a tenth of a kilo is plenty.
        value: formatMeasure(Math.abs(delta), 1),
        range,
      });
    }
    return this._translateService.instant('workouts.volume.deltaIn', {
      change: formatVolumeChange(delta, unit),
      range,
    });
  });

  /** What the card's line is, under its figure; the 1RM needs no words. */
  readonly caption = computed(() => {
    switch (this.metric()) {
      case ExerciseMetrics.TopSet:
        return this._topSetUnit() === VolumeUnits.Kg
          ? 'workouts.volume.exercise.caption.topSet'
          : 'workouts.volume.exercise.caption.best';
      case ExerciseMetrics.Volume:
        return `workouts.volume.exercise.caption.volume.${this._volumeUnit() ?? VolumeUnits.Kg}`;
      default:
        return null;
    }
  });

  readonly chartLabel = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return '';
    if (this.metric() === ExerciseMetrics.OneRepMax) {
      return this._translateService.instant('workouts.exerciseProgress.chartLabel', {
        from: formatMeasure(points[0].y, 1),
        to: formatMeasure(points[points.length - 1].y, 1),
      });
    }
    const unit = this._chartUnit() ?? VolumeUnits.Reps;
    const option = this.metricOptions().find((o) => o.value === this.metric());
    return this._translateService.instant('workouts.volume.chartLabel', {
      metric: option ? this._translateService.instant(option.label) : '',
      from: formatVolume(points[0].y, unit),
      to: formatVolume(points[points.length - 1].y, unit),
    });
  });

  /**
   * "The record hasn't moved since 21 Oct, but you did more at the same
   * weight": only when it is true over the range (`recordStillSince`).
   */
  readonly recordStill = computed(() => {
    const progress = this.progress();
    const since = progress ? recordStillSince(progress, this.range(), this.now()) : null;
    return since
      ? this._translateService.instant('workouts.volume.exercise.recordStill', {
          date: recordDayLabel(since, this.now()),
        })
      : '';
  });

  /**
   * Day and month at the ends and middle of four weeks; over a longer range,
   * month names where each month begins, so no name appears twice.
   */
  readonly xLabels = computed<TrendLabel[]>(() => {
    if (this.range() === '4w') {
      return trendTicks(this.rangeFrom(), this.now(), 3).map((at) => ({
        at,
        label: new Date(at).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }),
      }));
    }
    return monthTicks(this.rangeFrom(), this.now(), 4).map((at) => ({
      at,
      label: new Date(at).toLocaleDateString(appLocale(), { month: 'short' }),
      align: 'middle' as const,
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
        value: unbreakable(
          this._translateService.instant('workouts.exerciseProgress.setValue', {
            weight: formatMeasure(topSet.weightKg),
            reps: topSet.reps,
          }),
        ),
      };
      return [best, count, sets];
    }
    const best = this._bestValue();
    return best
      ? [
          count,
          sets,
          {
            label: this._translateService.instant('workouts.exerciseProgress.best'),
            value: unbreakable(best),
          },
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
    const request = this._clientId
      ? this._progressService.forClientExercise(this._clientId, id)
      : this._progressService.forExercise(id);
    request
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

  setMetric(value: unknown): void {
    const metric = this.metrics().find((option) => option === value);
    if (metric) this._pickedMetric.set(metric);
  }

  /**
   * The trainee reopens their own summary, in the stack this page is in; a
   * coach gets the review of that log.
   */
  openSession(workoutLogId: string): void {
    if (this._clientId) {
      void this._router.navigate([this._stack, 'log', workoutLogId]);
      return;
    }
    void this._router.navigate(this._workoutLinks.finish(workoutLogId));
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
