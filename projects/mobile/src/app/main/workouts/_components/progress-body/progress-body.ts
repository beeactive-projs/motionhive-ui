import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
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
  appLocale,
  ExerciseKind,
  formatTotalDuration,
  ProgressOverview,
  ProgressRange,
  ProgressService,
  TrainedExercise,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { StatTile } from '../../../../_shared/components/stat-tile/stat-tile';
import { clientPath, coachStackOf } from '../../../clients/client-paths';
import { workoutLinks } from '../../../home/home-stack.config';
import { BadgeTones, KIND_META } from '../../../exercises/exercises.config';
import {
  formatMeasure,
  logMeta,
  shortDayLabel,
  unbreakable,
} from '../../workouts.config';
import {
  formatWeekValue,
  shortWeekValue,
  WEEK_METRICS,
  weekBounds,
  weekDayLabel,
  WeekMetric,
  WeekMetrics,
  weekSlots,
  weekValue,
} from '../../volume.config';
import { BarChart, ChartBar } from '../bar-chart/bar-chart';
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

/** A tick under every fourth bar, counted back from this week. */
const TICK_EVERY = 4;

/** More workouts than anyone does in a week: the week's list is one page. */
const WEEK_LIST_LIMIT = 30;

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
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSkeletonText,
    StatTile,
    TranslatePipe,
    BarChart,
  ],
  templateUrl: './progress-body.html',
  styleUrl: './progress-body.scss',
})
export class ProgressBody {
  private readonly _progressService = inject(ProgressService);
  private readonly _workoutLogService = inject(WorkoutLogService);
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

  // ─── The twelve weeks ──────────────────────────────────────────────

  /** Pinned per load, so the weeks and "this week" agree. */
  private readonly _now = signal(Date.now());

  readonly weeks = computed(() => weekSlots(this.overview()?.weeklyVolume ?? [], this._now()));

  /** Time per week only from an API that sends it. */
  private readonly _hasMinutes = computed(() =>
    (this.overview()?.weeklyVolume ?? []).some((week) => week.minutes !== undefined),
  );

  readonly weekMetrics = computed(() =>
    WEEK_METRICS.filter((metric) => metric !== WeekMetrics.Time || this._hasMinutes()),
  );

  private readonly _pickedMetric = signal<WeekMetric | null>(null);

  /** Volume first, as the design leads with it; workouts for someone who lifts nothing. */
  readonly weekMetric = computed<WeekMetric>(() => {
    const picked = this._pickedMetric();
    if (picked && this.weekMetrics().includes(picked)) return picked;
    return this.weeks().some((week) => week.volumeKg > 0) ? WeekMetrics.Volume : WeekMetrics.Workouts;
  });

  private readonly _pickedWeek = signal<string | null>(null);

  /** The tapped week, else this one. */
  readonly selectedWeek = computed(() => this._pickedWeek() ?? this.weeks().at(-1)?.key ?? null);

  private readonly _selectedSlot = computed(() =>
    this.weeks().find((week) => week.key === this.selectedWeek()),
  );

  readonly weekBars = computed<ChartBar[]>(() => {
    const metric = this.weekMetric();
    const weeks = this.weeks();
    return weeks.map((week, i) => {
      const value = weekValue(week, metric);
      const date = weekDayLabel(week.key);
      return {
        key: week.key,
        value,
        tick: (weeks.length - 1 - i) % TICK_EVERY === 0 ? date : '',
        label: this._translateService.instant('workouts.volume.weeks.barLabel', {
          date,
          value: formatWeekValue(value, metric),
        }),
        top: shortWeekValue(value, metric),
      };
    });
  });

  /** The selected week's figure, "11,240 kg". */
  readonly weekHeadline = computed(() => {
    const slot = this._selectedSlot();
    return slot ? unbreakable(formatWeekValue(weekValue(slot, this.weekMetric()), this.weekMetric())) : '';
  });

  /** "This week", or "Week of 26 Oct". */
  readonly weekTitle = computed(() => {
    const key = this.selectedWeek();
    if (!key) return '';
    return key === this.weeks().at(-1)?.key
      ? this._translateService.instant('workouts.volume.weeks.thisWeek')
      : this._translateService.instant('workouts.volume.weeks.weekOf', { date: weekDayLabel(key) });
  });

  /** The workouts of the selected week, read when it is picked. */
  readonly weekLogs = signal<WorkoutLog[]>([]);
  readonly weekLoading = signal(false);
  readonly weekError = signal(false);
  /** The week the list belongs to: a slow answer for another week is dropped. */
  private _weekRequest: string | null = null;

  readonly weekRows = computed(() =>
    this.weekLogs().map((log) => ({
      id: log.id,
      name: log.name,
      // "Wed 28 Oct · 48m · 16 sets", as History's rows say it.
      line: [shortDayLabel(log.completedAt ?? log.startedAt), logMeta(log)]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  private readonly _weekHasWorkouts = computed(() => (this._selectedSlot()?.workouts ?? 0) > 0);

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

  setWeekMetric(metric: WeekMetric): void {
    this._pickedMetric.set(metric);
  }

  pickWeek(key: string): void {
    this._pickedWeek.set(key);
    this.loadWeek();
  }

  /**
   * The selected week's workouts, from History's own list bounded to that
   * week (a coach's read of the client's, under the same rule as the
   * numbers). A week with none asks nothing.
   */
  loadWeek(): void {
    const key = this.selectedWeek();
    this._weekRequest = key;
    this.weekError.set(false);
    if (!key || !this._weekHasWorkouts()) {
      this.weekLogs.set([]);
      this.weekLoading.set(false);
      return;
    }
    this.weekLoading.set(true);
    const query = { ...weekBounds(key), limit: WEEK_LIST_LIMIT };
    const clientId = this.clientId();
    const request = clientId
      ? this._workoutLogService.listForClient(clientId, query, { silent: true })
      : this._workoutLogService.list(query, { silent: true });
    request.pipe(take(1)).subscribe({
      next: (page) => {
        if (this._weekRequest !== key) return;
        this.weekLogs.set(page.items);
        this.weekLoading.set(false);
      },
      error: () => {
        if (this._weekRequest !== key) return;
        this.weekLogs.set([]);
        this.weekError.set(true);
        this.weekLoading.set(false);
      },
    });
  }

  /** The trainee reopens their summary; a coach, the review of that workout. */
  openWorkout(workoutLogId: string): void {
    if (this.clientId()) {
      void this._router.navigate([coachStackOf(this._router.url), 'log', workoutLogId]);
      return;
    }
    void this._router.navigate(workoutLinks(this._router.url).finish(workoutLogId));
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
        this._now.set(Date.now());
        this.overview.set(overview);
        this.loaded.set(true);
        this.loading.set(false);
        this.loadWeek();
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
