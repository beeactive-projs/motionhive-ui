import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { finalize, take } from 'rxjs/operators';

import {
  ProgramAssignmentKind,
  Routine,
  TrainingDayPlan,
  WorkoutLogService,
  displayName,
  localDayKey,
} from 'core';

import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { ExerciseLibrary } from '../exercises/_components/exercise-library/exercise-library';
import { ExercisesStore } from '../exercises/exercises.store';
import { HistoryBody } from './_components/history-body/history-body';
import { ProgressBody } from './_components/progress-body/progress-body';
import { RoutineRow } from './_components/routine-row/routine-row';
import { TodayHero } from './_components/today-hero/today-hero';
import { RoutineActionsService } from './_services/routine-actions.service';
import { HistoryStore } from './history/history.store';
import {
  ROUTINE_EDIT_PARAM,
  RoutineActionId,
  RoutineActionIds,
  RoutineSwipes,
  WORKOUT_ICONS,
  WorkoutStartAction,
  WorkoutStartActions,
  WorkoutTab,
  WorkoutTabs,
  planWeekLabel,
  routineActions,
  routineTileColor,
  workoutClock,
  workoutStartActions,
  workoutTabFrom,
} from './workouts.config';
import { WorkoutsStore } from './workouts.store';

/** Plans shown before "See all": enough to keep the routines in reach. */
const PLAN_PREVIEW_LIMIT = 3;

/**
 * The Workouts tab — the trainee's front door to training, in four tabs:
 * Routines (what you train from), History (what you did), Progress (how it
 * is going) and Exercises (the movements it is built from). `?tab=` opens
 * one; the old History, Progress and library addresses redirect here. The
 * lists keep their state across tab switches (their stores live on this
 * page) and re-read when shown.
 *
 * The two ways to begin, an empty workout and a new routine, sit behind the
 * header's honey "+". Routines' order is deliberate: anything already in progress
 * outranks everything, then what a plan says to do today, the plans, and
 * your routines, where a swipe left offers More (copy, archive, delete) and
 * Edit.
 *
 * One workout at a time: while a session is open, nothing on this page offers
 * to start another. Today's day turns into something to look at, and the
 * empty-workout on-ramp waits until the open session is finished.
 */
@Component({
  selector: 'mh-workouts',
  imports: [
    ActionSheet,
    ConfirmSheet,
    EmptyState,
    ExerciseLibrary,
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
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    HistoryBody,
    NotificationBell,
    ProgressBody,
    RoutineRow,
    SessionRowSkeleton,
    TodayHero,
    TranslatePipe,
  ],
  providers: [WorkoutsStore, HistoryStore, ExercisesStore],
  templateUrl: './workouts.html',
  styleUrl: './workouts.scss',
})
export class Workouts implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(WorkoutsStore);
  private readonly _historyStore = inject(HistoryStore);
  private readonly _exercisesStore = inject(ExercisesStore);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _routineActionsService = inject(RoutineActionsService);
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
  readonly Tabs = WorkoutTabs;
  readonly Swipes = RoutineSwipes;

  /** The tab a link asked for, until you pick another. */
  readonly tab = signal<WorkoutTab>(WorkoutTabs.Routines);
  private readonly _progressBody = viewChild(ProgressBody);
  /** Where an exercise opens from the Exercises tab: this stack, so back returns here. */
  readonly exerciseBase = ['/tabs/workouts/exercise'];

  readonly actionsOpen = signal(false);
  /** The "+" sheet: an empty workout (unless one is open) and a new routine. */
  readonly startActions = computed(() => workoutStartActions(!this.store.inProgress()));

  /** Every plan, or the first few: a long list would bury the routines. */
  readonly showAllPlans = signal(false);
  readonly visiblePlans = computed(() => {
    const plans = this.store.activePlans();
    return this.showAllPlans() ? plans : plans.slice(0, PLAN_PREVIEW_LIMIT);
  });
  readonly hasHiddenPlans = computed(() => this.store.activePlans().length > PLAN_PREVIEW_LIMIT);

  /** The routine whose swipe was used; the More, copy and delete sheets act on it. */
  private readonly _routineTarget = signal<Routine | null>(null);
  readonly routineName = computed(() => this._routineTarget()?.name ?? '');
  readonly routineActionsOpen = signal(false);
  /** Edit is the row's own swipe, so the More sheet holds the rest. */
  readonly routineSheetActions = routineActions(true);
  readonly copyOpen = signal(false);
  readonly copying = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);
  /** A copy opens once made, so its sheet is closed before navigating (see ConfirmSheet.close). */
  private readonly _copySheet = viewChild<ConfirmSheet>('copySheet');

  readonly copyBody = computed(() =>
    this._translateService.instant('workouts.routineBuilder.copyConfirm.body', {
      name: this.routineName(),
    }),
  );

  readonly deleteBody = computed(() =>
    this._translateService.instant('workouts.routineBuilder.delete.message', {
      name: this.routineName(),
    }),
  );

  private readonly _todayKey = computed(() => localDayKey(new Date(this._clockService.now())));

  /** How long the open session has been trained, for the resume banner. */
  readonly elapsed = computed(() => {
    const log = this.store.inProgress();
    return log ? workoutClock(log, this._now()) : '';
  });

  /** A paused session's clock stands still, so the banner says why. */
  readonly isPaused = computed(() => !!this.store.inProgress()?.pausedAt);

  constructor() {
    addIcons(WORKOUT_ICONS);

    // `?tab=` on arrival, and again when a link (a redirect from the old
    // History or Progress address) lands on this page while it is alive.
    this._route.queryParamMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const tab = params.get('tab');
      if (tab) this.setTab(tab);
    });

    // Progress reads its numbers each time it is shown.
    effect(() => {
      const body = this._progressBody();
      if (body) untracked(() => body.load());
    });

    effect((onCleanup) => {
      if (!this._visible() || !this.store.inProgress() || this.isPaused()) return;
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
    // A workout finished since belongs at the top of History, and in Progress.
    if (this.tab() === WorkoutTabs.History) this._historyStore.refresh();
    if (this.tab() === WorkoutTabs.Progress) this._progressBody()?.load();
    if (this.tab() === WorkoutTabs.Exercises) this._exercisesStore.refresh();
  }

  setTab(value: unknown): void {
    const tab = workoutTabFrom(value);
    if (tab === this.tab()) return;
    this.tab.set(tab);
    if (tab === WorkoutTabs.History) this._historyStore.refresh();
    if (tab === WorkoutTabs.Exercises) this._exercisesStore.refresh();
  }

  onStartAction(action: WorkoutStartAction): void {
    if (action === WorkoutStartActions.StartEmpty) this.startEmpty();
    else this.newRoutine();
  }

  ionViewWillLeave(): void {
    this._visible.set(false);
  }

  /** Pull to refresh re-reads the tab on screen. */
  onRefresh(event: RefresherCustomEvent): void {
    const done = () => void event.target.complete();
    switch (this.tab()) {
      case WorkoutTabs.History:
        this._historyStore.refresh(done);
        return;
      case WorkoutTabs.Progress:
        this._progressBody()?.load();
        done();
        return;
      case WorkoutTabs.Exercises:
        this._exercisesStore.refresh(done);
        return;
      default:
        this._clockService.bump();
        this.store.load({ done });
    }
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

  /** Your archived routines, on a page of their own. */
  openArchived(): void {
    void this._router.navigate(['/tabs/workouts/archived']);
  }

  // ─── A routine's swipes ───────────────────────────────────────

  /** Straight into the builder, past the read view. */
  editRoutine(routine: Routine): void {
    void this._router.navigate(['/tabs/workouts/routine', routine.id], {
      queryParams: { [ROUTINE_EDIT_PARAM]: true },
    });
  }

  openRoutineActions(routine: Routine): void {
    this._routineTarget.set(routine);
    this.routineActionsOpen.set(true);
  }

  /** The sheet reports the verb once it has closed, so a confirm can open straight after. */
  onRoutineAction(id: RoutineActionId): void {
    switch (id) {
      case RoutineActionIds.Duplicate:
        this.copyOpen.set(true);
        return;
      case RoutineActionIds.Archive:
        this._archiveRoutine();
        return;
      case RoutineActionIds.Delete:
        this.deleteOpen.set(true);
        return;
    }
  }

  /** Asked first, then opened, as from the routine's own page: the copy is the one to change. */
  makeCopy(): void {
    const target = this._routineTarget();
    if (!target || this.copying()) return;
    this.copying.set(true);
    this._routineActionsService
      .copy(target.id)
      .pipe(finalize(() => this.copying.set(false)))
      .subscribe(async (copy) => {
        await this._copySheet()?.close();
        void this._router.navigate(['/tabs/workouts/routine', copy.id]);
      });
  }

  /**
   * Undone from the archive in one tap, so it happens on the tap. The row
   * leaves once the server agrees; a second Archive meanwhile sends nothing.
   */
  private _archiveRoutine(): void {
    const target = this._routineTarget();
    if (!target) return;
    this._routineActionsService
      .setArchived(target.id, true)
      .subscribe(() => this.store.moveToArchived(target.id));
  }

  /** After the red confirm. The workouts logged from it stay in History. */
  confirmDeleteRoutine(): void {
    const target = this._routineTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this._routineActionsService
      .remove(target.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(() => {
        this.deleteOpen.set(false);
        this.store.dropRoutine(target.id);
      });
  }

  // ─── Libraries ────────────────────────────────────────────────

  newRoutine(): void {
    void this._router.navigate(['/tabs/workouts/routine', 'new']);
  }

  openStarters(): void {
    void this._router.navigate(['/tabs/workouts/starters']);
  }

  openPlan(planId: string): void {
    void this._router.navigate(['/tabs/workouts/plan', planId]);
  }
}
