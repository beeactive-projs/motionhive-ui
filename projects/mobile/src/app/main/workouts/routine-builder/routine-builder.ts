import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  CreateRoutineExercisePayload,
  Routine,
  RoutineService,
  WorkoutLogService,
} from 'core';

import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { WORKOUT_ICONS } from '../workouts.config';

/** A row being authored, before it is a saved routine. */
interface DraftExercise {
  exerciseId: string;
  name: string;
  sets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
}

const DEFAULT_SETS = 3;

/**
 * The routine builder — the logger without a stopwatch.
 *
 * Uses the same exercise picker the live logger uses, so adding an exercise
 * is one learned gesture rather than two. Targets are optional here for the
 * same reason actuals are optional there: a routine that only names the
 * movements in order is still a useful routine.
 *
 * Handles `new` and an existing id on the same screen — the only difference
 * is whether the save is a create or an update.
 */
@Component({
  selector: 'mh-routine-builder',
  imports: [
    ExercisePickerSheet,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './routine-builder.html',
  styleUrl: './routine-builder.scss',
})
export class RoutineBuilder implements ViewWillEnter {
  private readonly _routineService = inject(RoutineService);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly routine = signal<Routine | null>(null);
  readonly name = signal('');
  readonly exercises = signal<DraftExercise[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly pickerOpen = signal(false);

  private _id: string | null = null;

  readonly isNew = computed(() => this._id === 'new' || this._id === null);

  /** A starter belongs to nobody: runnable and copyable, never editable. */
  readonly readOnly = computed(() => this.routine()?.source === 'SYSTEM');

  readonly canSave = computed(
    () => !!this.name().trim() && this.exercises().length > 0 && !this.readOnly(),
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id === this._id) return;
    this._id = id;

    if (!id || id === 'new') {
      this.routine.set(null);
      this.name.set('');
      this.exercises.set([]);
      return;
    }

    this.loading.set(true);
    this._routineService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (routine) => {
          this.routine.set(routine);
          this.name.set(routine.name);
          this.exercises.set(
            (routine.exercises ?? []).map((e) => ({
              exerciseId: e.exerciseId,
              name: e.exercise?.name ?? 'Exercise',
              sets: e.defaultSets || DEFAULT_SETS,
              targetRepsMin: e.targetRepsMin,
              targetRepsMax: e.targetRepsMax,
            })),
          );
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          void this._feedback.error(err, 'Could not open that routine');
        },
      });
  }

  // ─── Editing ──────────────────────────────────────────────────

  onPicked(picked: { id: string; name: string }[]): void {
    this.pickerOpen.set(false);
    if (!picked.length) return;
    this.exercises.update((rows) => [
      ...rows,
      ...picked.map((p) => ({
        exerciseId: p.id,
        name: p.name,
        sets: DEFAULT_SETS,
        targetRepsMin: null,
        targetRepsMax: null,
      })),
    ]);
  }

  setCount(index: number, delta: number): void {
    this.exercises.update((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, sets: Math.max(1, row.sets + delta) } : row,
      ),
    );
  }

  remove(index: number): void {
    this.exercises.update((rows) => rows.filter((_, i) => i !== index));
  }

  // ─── Saving ───────────────────────────────────────────────────

  save(): void {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);

    const payload = {
      name: this.name().trim(),
      exercises: this.exercises().map<CreateRoutineExercisePayload>((row) => ({
        exerciseId: row.exerciseId,
        defaultSets: row.sets,
        ...(row.targetRepsMin != null ? { targetRepsMin: row.targetRepsMin } : {}),
        ...(row.targetRepsMax != null ? { targetRepsMax: row.targetRepsMax } : {}),
      })),
    };

    const request = this.isNew()
      ? this._routineService.create(payload)
      : this._routineService.update(this._id!, payload);

    request.pipe(take(1)).subscribe({
      next: () => {
        this.saving.set(false);
        void this._feedback.success('Routine saved');
        void this._router.navigate(['/tabs/workouts']);
      },
      error: (err) => {
        this.saving.set(false);
        void this._feedback.error(err, 'Could not save the routine');
      },
    });
  }

  /** Starting a starter deep-copies it into your library, server-side. */
  start(): void {
    const id = this._id;
    if (!id || id === 'new' || this.starting()) return;

    this.starting.set(true);
    this._routineService
      .start(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.starting.set(false);
          void this._router.navigate(['/tabs/workouts/log', log.id], { replaceUrl: true });
        },
        error: (err) => {
          this.starting.set(false);
          void this._feedback.error(err, 'Could not start that routine');
        },
      });
  }
}
