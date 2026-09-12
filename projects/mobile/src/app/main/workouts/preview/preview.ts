import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  WorkoutLogService,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
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
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './preview.html',
  styleUrl: './preview.scss',
})
export class Preview implements ViewWillEnter {
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly workout = signal<AssignedWorkout | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly starting = signal(false);
  readonly noteOpen = signal(false);

  readonly position = computed(() => {
    const w = this.workout();
    if (!w) return '';
    return planPositionLabel(
      this.assignment()?.programNameSnapshot ?? null,
      w.weekIndex,
      w.dayIndex,
    );
  });

  readonly meta = computed(() => {
    const w = this.workout();
    if (!w) return '';
    return workoutMetaLine(w.exercises?.length ?? null, w.estimatedDurationMinutes);
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const assignmentId = this._route.snapshot.paramMap.get('assignmentId');
    const workoutId = this._route.snapshot.queryParamMap.get('workout');
    if (!assignmentId) return;

    this.loading.set(true);
    this.failed.set(false);
    this._assignmentService
      .get(assignmentId)
      .pipe(take(1))
      .subscribe({
        next: (assignment) => {
          this.assignment.set(assignment);
          const days = assignment.workouts ?? [];
          // Falls back to the first unfinished day so a stale link still
          // lands somewhere useful rather than on an error.
          this.workout.set(
            days.find((d) => d.id === workoutId) ?? days.find((d) => !d.status) ?? null,
          );
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  start(): void {
    const workout = this.workout();
    if (!workout || this.starting()) return;

    this.starting.set(true);
    this._logService
      .start({ assignedWorkoutId: workout.id })
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.starting.set(false);
          void this._router.navigate(['/tabs/workouts/log', log.id], { replaceUrl: true });
        },
        error: (err) => {
          this.starting.set(false);
          void this._feedback.error(err, 'Could not start the workout');
        },
      });
  }

  skip(): void {
    const workout = this.workout();
    if (!workout) return;
    this._assignmentService
      .skipAssignedWorkout(workout.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          void this._feedback.success('Marked as skipped');
          void this._router.navigate(['/tabs/workouts']);
        },
        error: (err) => void this._feedback.error(err, 'Could not skip that'),
      });
  }
}
