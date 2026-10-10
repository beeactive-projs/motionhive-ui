import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  AssignedExercise,
  AssignedWorkout,
  ExerciseKind,
  ProgramAssignment,
  ProgramAssignmentKind,
  ProgramAssignmentService,
  WorkoutLogService,
  localDayKey,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { OverviewExercise, WorkoutOverview } from '../_components/workout-overview/workout-overview';
import { WORKOUT_ICONS, planPositionLabel, prescriptionLine } from '../workouts.config';

/**
 * What today's prescribed workout holds, before committing to it.
 *
 * Exists so a trainee can see what they are walking into — the coach's note
 * and the exercise list — rather than discovering it one set at a time. The
 * log is only created when they tap Start.
 */
@Component({
  selector: 'mh-workout-preview',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    TranslatePipe,
    WorkoutOverview,
  ],
  templateUrl: './preview.html',
  styleUrl: './preview.scss',
})
export class Preview implements ViewWillEnter {
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _activeWorkoutService = inject(ActiveWorkoutService);
  private readonly _translateService = inject(TranslateService);

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly workout = signal<AssignedWorkout | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly starting = signal(false);

  readonly skeletonRows = [1, 2, 3, 4];

  readonly showSkeleton = computed(() => this.loading() && !this.assignment());
  readonly showError = computed(() => this.error() && !this.assignment());

  /** Loaded fine, but the plan holds no days at all — a different problem. */
  readonly isEmptyPlan = computed(
    () => !this.loading() && !this.error() && !!this.assignment() && !this.workout(),
  );

  /** "Today's workout" only when it is — the same screen opens the next day too. */
  readonly title = computed(() =>
    this._translateService.instant(
      this.workout()?.scheduledDate === localDayKey(new Date())
        ? 'workouts.preview.todaysWorkout'
        : 'workouts.common.workout',
    ),
  );

  /** "Strength block · Week 3 · Day 2": the phase when the plan names one. */
  readonly eyebrow = computed(() => {
    const workout = this.workout();
    if (!workout) return '';
    return planPositionLabel(
      workout.phase ?? this.assignment()?.programNameSnapshot ?? null,
      workout.weekIndex,
      workout.dayIndex,
    );
  });

  readonly chips = computed(() => {
    const workout = this.workout();
    if (!workout) return [];
    const chips: string[] = [];
    if (workout.estimatedDurationMinutes != null) {
      chips.push(
        this._translateService.instant('workouts.meta.aboutMinutes', {
          minutes: workout.estimatedDurationMinutes,
        }),
      );
    }
    chips.push(
      this._translateService.instant('count.exercises', { count: workout.exercises?.length ?? 0 }),
    );
    return chips;
  });

  /** The coach by first name; a plan you scheduled yourself has no coach to name. */
  readonly noteLabel = computed(() => {
    const assignment = this.assignment();
    if (assignment?.assignmentKind === ProgramAssignmentKind.Self) {
      return this._translateService.instant('workouts.routineView.notes');
    }
    const name = assignment?.instructor?.firstName;
    return name
      ? this._translateService.instant('workouts.preview.noteFrom', { name })
      : this._translateService.instant('workouts.preview.noteFromCoach');
  });

  readonly exercises = computed<OverviewExercise[]>(() =>
    (this.workout()?.exercises ?? []).map((exercise) => ({
      key: exercise.id,
      exercise: {
        id: exercise.exerciseId,
        name: exercise.exercise?.name ?? this._translateService.instant('workouts.common.exercise'),
        kind: this._kindOf(exercise),
        thumbnailUrl: exercise.exercise?.thumbnailUrl ?? null,
      },
      prescription: prescriptionLine(exercise.sets ?? []),
    })),
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    const assignmentId = this._route.snapshot.paramMap.get('assignmentId');
    const workoutId = this._route.snapshot.queryParamMap.get('workout');
    if (!assignmentId) return;

    this.loading.set(true);
    this.error.set(false);
    this._programAssignmentService
      .get(assignmentId)
      .pipe(take(1))
      .subscribe({
        next: (assignment) => {
          this.assignment.set(assignment);
          const days = assignment.workouts ?? [];
          // Three answers, in order: the day that was asked for, the next one
          // still to do, or — on a plan whose days are all behind you — the
          // last one. A finished plan used to fall through all of these and
          // render "could not open this workout", which is not what happened.
          this.workout.set(
            days.find((d) => d.id === workoutId) ??
              days.find((d) => !d.status) ??
              days[days.length - 1] ??
              null,
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /** The catalog page, pushed onto this stack so back returns here. */
  openExercise(exerciseId: string): void {
    void this._router.navigate(['/tabs/workouts/exercise', exerciseId]);
  }

  start(): void {
    const workout = this.workout();
    if (!workout || this.starting()) return;

    this.starting.set(true);
    this._activeWorkoutService.startOrResume(() => this._start(workout), {
      // This very day, begun earlier and left: just carry on with it.
      isSame: (open) => open.assignedWorkoutId === workout.id,
      onBlocked: () => this.starting.set(false),
    });
  }

  private _start(workout: AssignedWorkout): void {
    this._workoutLogService
      .start({ assignedWorkoutId: workout.id })
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.starting.set(false);
          void this._router.navigate(['/tabs/workouts/log', log.id], { replaceUrl: true });
        },
        error: (err) => {
          this.starting.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.common.startFailed'),
          );
        },
      });
  }

  skip(): void {
    const workout = this.workout();
    if (!workout) return;
    this._programAssignmentService
      .skipAssignedWorkout(workout.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          void this._feedbackService.success(
            this._translateService.instant('workouts.preview.toast.skipped'),
          );
          void this._router.navigate(['/tabs/workouts']);
        },
        error: (err) =>
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.preview.toast.skipFailed'),
          ),
      });
  }

  /** The catalogue row is typed loosely on the assignment tree; strength is the safe default. */
  private _kindOf(exercise: AssignedExercise): ExerciseKind {
    return (exercise.exercise?.kind as ExerciseKind | undefined) ?? ExerciseKind.Strength;
  }
}
