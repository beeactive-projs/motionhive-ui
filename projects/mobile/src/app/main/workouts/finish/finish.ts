import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService } from 'core';

import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { WORKOUT_ICONS } from '../workouts.config';

/** The emoji scale, as a rating affordance rather than decorative copy. */
const FEELINGS = [
  { value: 1, glyph: '😣' },
  { value: 2, glyph: '😕' },
  { value: 3, glyph: '😐' },
  { value: 4, glyph: '🙂' },
  { value: 5, glyph: '💪' },
];

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
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonTextarea,
    IonTitle,
    IonToolbar,
    StatTile,
  ],
  templateUrl: './finish.html',
  styleUrl: './finish.scss',
})
export class Finish implements ViewWillEnter {
  private readonly _logService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly feelings = FEELINGS;

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saving = signal(false);

  readonly feeling = signal<number | null>(null);
  readonly note = signal('');
  readonly routineName = signal('');
  readonly savingRoutine = signal(false);

  /** Already finished — then this is a read-only look back, not a form. */
  readonly isReview = computed(() => this.log()?.status === 'COMPLETED');

  /** A freestyle session is the one that can become a routine. */
  readonly canSaveAsRoutine = computed(() => {
    const log = this.log();
    return !!log && !log.assignedWorkoutId && !log.sourceProgramId;
  });

  readonly durationLabel = computed(() => {
    const seconds = this.log()?.durationSeconds;
    if (!seconds) return '—';
    const mins = Math.round(seconds / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
  });

  /** Only the modalities the session actually contained get a tile. */
  readonly tiles = computed(() => {
    const exercises = this.log()?.exercises ?? [];
    const sets = exercises.flatMap((e) => e.sets ?? []).filter((s) => s.isCompleted);

    const volume = sets.reduce(
      (sum, s) => sum + (s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0),
      0,
    );
    const bodyweightReps = sets
      .filter((s) => s.weightKg == null && s.reps != null)
      .reduce((sum, s) => sum + (s.reps ?? 0), 0);
    const holdSeconds = sets.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
    const distance = sets.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);

    const tiles: { label: string; value: string }[] = [
      { label: 'Sets', value: String(sets.length) },
    ];
    if (volume > 0) tiles.push({ label: 'Volume', value: `${Math.round(volume)} kg` });
    if (bodyweightReps > 0) tiles.push({ label: 'Reps', value: String(bodyweightReps) });
    if (holdSeconds > 0) tiles.push({ label: 'Time', value: `${Math.round(holdSeconds / 60)} min` });
    if (distance > 0) tiles.push({ label: 'Distance', value: `${distance} m` });
    return tiles;
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading.set(true);
    this._logService
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
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  save(): void {
    const log = this.log();
    if (!log || this.saving()) return;

    this.saving.set(true);
    this._logService
      .complete(log.id, {
        feelingRating: this.feeling() ?? undefined,
        notes: this.note().trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this._feedback.success('Workout saved');
          void this._router.navigate(['/tabs/workouts']);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedback.error(err, 'Could not save the workout');
        },
      });
  }

  saveAsRoutine(): void {
    const log = this.log();
    const name = this.routineName().trim();
    if (!log || !name || this.savingRoutine()) return;

    this.savingRoutine.set(true);
    this._logService
      .saveAsRoutine(log.id, { name })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingRoutine.set(false);
          void this._feedback.success(`Saved "${name}"`);
        },
        error: (err) => {
          this.savingRoutine.set(false);
          void this._feedback.error(err, 'Could not save that routine');
        },
      });
  }

  /** "Bench press day" — the first exercise is what people call a session. */
  private _suggestName(log: WorkoutLog): string {
    const first = log.exercises?.[0]?.exerciseNameSnapshot;
    return first ? `${first} day` : log.name;
  }
}
