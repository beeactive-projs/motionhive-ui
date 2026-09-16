import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  AssignedExercise,
  AssignedWorkout,
  ExerciseKind,
  ProgramAssignment,
  ProgramAssignmentService,
  WorkoutLogService,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { kindIcon, kindTone } from '../../exercises/exercises.config';
import { WORKOUT_ICONS, planPositionLabel, workoutMetaLine } from '../workouts.config';

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
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
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

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly workout = signal<AssignedWorkout | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly starting = signal(false);
  readonly noteOpen = signal(false);

  readonly skeletonRows = [1, 2, 3, 4];

  readonly showSkeleton = computed(() => this.loading() && !this.assignment());
  readonly showError = computed(() => this.error() && !this.assignment());

  /** Loaded fine, but the plan holds no days at all — a different problem. */
  readonly isEmptyPlan = computed(
    () => !this.loading() && !this.error() && !!this.assignment() && !this.workout(),
  );

  readonly position = computed(() => {
    const workout = this.workout();
    if (!workout) return '';
    return planPositionLabel(
      this.assignment()?.programNameSnapshot ?? null,
      workout.weekIndex,
      workout.dayIndex,
    );
  });

  readonly meta = computed(() => {
    const workout = this.workout();
    if (!workout) return '';
    return workoutMetaLine(workout.exercises?.length ?? null, workout.estimatedDurationMinutes);
  });

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

  exerciseName(exercise: AssignedExercise): string {
    return exercise.exercise?.name ?? 'Exercise';
  }

  setsLabel(exercise: AssignedExercise): string {
    const n = (exercise.sets ?? []).length;
    return `${n} ${n === 1 ? 'set' : 'sets'}`;
  }

  /** The kind-tinted hex tile, same as the library row draws it. */
  tileIcon(exercise: AssignedExercise): string {
    return kindIcon(this._kindOf(exercise));
  }

  tileTone(exercise: AssignedExercise): string {
    return kindTone(this._kindOf(exercise));
  }

  toggleNote(): void {
    this.noteOpen.update((open) => !open);
  }

  start(): void {
    const workout = this.workout();
    if (!workout || this.starting()) return;

    this.starting.set(true);
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
          void this._feedbackService.error(err, 'Could not start the workout');
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
          void this._feedbackService.success('Marked as skipped');
          void this._router.navigate(['/tabs/workouts']);
        },
        error: (err) => void this._feedbackService.error(err, 'Could not skip that'),
      });
  }

  /** The catalogue row is typed loosely on the assignment tree; strength is the safe default. */
  private _kindOf(exercise: AssignedExercise): ExerciseKind {
    return (exercise.exercise?.kind as ExerciseKind | undefined) ?? ExerciseKind.Strength;
  }
}
