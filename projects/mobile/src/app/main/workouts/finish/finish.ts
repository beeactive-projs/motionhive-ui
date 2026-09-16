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
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { LoggedExercise, WorkoutLog, WorkoutLogService, WorkoutLogStatus } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  FEELINGS,
  WORKOUT_ICONS,
  exerciseSetSummary,
  workoutDuration,
  workoutTiles,
} from '../workouts.config';

/**
 * Finish and summary.
 *
 * Metric tiles are conditional on what the session actually contained —
 * volume only where something was loaded, reps for bodyweight, time for
 * holds. Compositing them into one number is the mistake every app that
 * tried it made.
 *
 * Doubles as the read-only view of a past workout, reached from History.
 */
@Component({
  selector: 'mh-workout-finish',
  imports: [
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    StatTile,
  ],
  templateUrl: './finish.html',
  styleUrl: './finish.scss',
})
export class Finish implements ViewWillEnter {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

  readonly feelings = FEELINGS;
  readonly skeletonTiles = [1, 2, 3];

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);

  readonly feeling = signal<number | null>(null);
  readonly note = signal('');
  readonly routineName = signal('');
  readonly savingRoutine = signal(false);

  readonly showSkeleton = computed(() => this.loading() && !this.log());
  readonly showError = computed(() => this.error() && !this.log());

  /** Already finished — then this is a read-only look back, not a form. */
  readonly isReview = computed(() => this.log()?.status === WorkoutLogStatus.Completed);

  /** A freestyle session is the one that can become a routine. */
  readonly canSaveAsRoutine = computed(() => {
    const log = this.log();
    return !!log && !log.assignedWorkoutId && !log.sourceProgramId;
  });

  readonly durationLabel = computed(
    () => workoutDuration(this.log()?.durationSeconds) || '—',
  );

  /** Only the modalities the session actually contained get a tile. */
  readonly tiles = computed(() => {
    const log = this.log();
    return log ? workoutTiles(log) : [];
  });

  readonly exercises = computed<LoggedExercise[]>(() => this.log()?.exercises ?? []);

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading.set(true);
    this.error.set(false);
    this._workoutLogService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.log.set(log);
          this.feeling.set(log.feelingRating);
          this.note.set(log.notes ?? '');
          this.routineName.set(this._suggestName(log));
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  setSummary(exercise: LoggedExercise): string {
    return exerciseSetSummary(exercise);
  }

  save(): void {
    const log = this.log();
    if (!log || this.saving()) return;

    this.saving.set(true);
    this._workoutLogService
      .complete(log.id, {
        feelingRating: this.feeling() ?? undefined,
        notes: this.note().trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this._feedbackService.success('Workout saved');
          void this._router.navigate(['/tabs/workouts']);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(err, 'Could not save the workout');
        },
      });
  }

  saveAsRoutine(): void {
    const log = this.log();
    const name = this.routineName().trim();
    if (!log || !name || this.savingRoutine()) return;

    this.savingRoutine.set(true);
    this._workoutLogService
      .saveAsRoutine(log.id, { name })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingRoutine.set(false);
          void this._feedbackService.success(`Saved "${name}"`);
        },
        error: (err) => {
          this.savingRoutine.set(false);
          void this._feedbackService.error(err, 'Could not save that routine');
        },
      });
  }

  /** "Bench press day" — the first exercise is what people call a session. */
  private _suggestName(log: WorkoutLog): string {
    const first = log.exercises?.[0]?.exerciseNameSnapshot;
    return first ? `${first} day` : log.name;
  }
}
