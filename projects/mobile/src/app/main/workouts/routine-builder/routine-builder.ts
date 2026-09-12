import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  /** Stable across re-renders; the exercise id is unique per routine. */
  key: string;
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
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly routine = signal<Routine | null>(null);
  readonly name = signal('');
  readonly exercises = signal<DraftExercise[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly pickerOpen = signal(false);

  /**
   * A signal, not a field: `isNew` is a computed over it, and a computed
   * cannot see a plain property change. Held as one it stayed true for the
   * life of the page, which hid the Start button on every saved routine.
   */
  private readonly _id = signal<string | null>(null);

  readonly isNew = computed(() => {
    const id = this._id();
    return id === 'new' || id === null;
  });

  /** A starter belongs to nobody: runnable and copyable, never editable. */
  readonly readOnly = computed(() => this.routine()?.source === 'SYSTEM');

  readonly canSave = computed(
    () => !!this.name().trim() && this.exercises().length > 0 && !this.readOnly(),
  );

  /** What the picker should already show as taken. */
  readonly addedIds = computed(() => this.exercises().map((row) => row.exerciseId));

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    // Read the live URL, not `route.snapshot`: Ionic keeps this page in the
    // tab stack, so one instance serves every visit and the snapshot can
    // still describe the route the page was created with.
    const id = this._router.url.split('?')[0].split('/').pop() ?? null;

    // `new` is not an identity. Two visits to it are two different routines,
    // so it always starts clean — guarding on equality here is what left the
    // previous routine's name and exercises sitting in the form.
    if (!id || id === 'new') {
      this._id.set('new');
      this.routine.set(null);
      this.name.set('');
      this.exercises.set([]);
      this.pickerOpen.set(false);
      return;
    }

    if (id === this._id()) return;
    this._id.set(id);

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
              key: e.id,
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

  /**
   * Adds the picked movements, skipping any already in the routine. Adding
   * the same exercise twice by accident is far more common than wanting it
   * twice on purpose — and wanting more of it is what the sets stepper is for.
   */
  onPicked(picked: { id: string; name: string }[]): void {
    this.pickerOpen.set(false);
    if (!picked.length) return;

    const have = new Set(this.exercises().map((row) => row.exerciseId));
    const fresh = picked.filter((p) => !have.has(p.id));
    const skipped = picked.length - fresh.length;

    if (fresh.length) {
      this.exercises.update((rows) => [
        ...rows,
        ...fresh.map((p) => ({
          key: p.id,
          exerciseId: p.id,
          name: p.name,
          sets: DEFAULT_SETS,
          targetRepsMin: null,
          targetRepsMax: null,
        })),
      ]);
    }

    if (skipped > 0) {
      void this._feedback.info(
        skipped === 1
          ? 'That exercise is already in this routine'
          : `${skipped} were already in this routine`,
      );
    }
  }

  /** The catalog page, pushed onto this stack so the draft survives. */
  openExercise(row: DraftExercise): void {
    void this._router.navigate(['/tabs/workouts/exercise', row.exerciseId]);
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
      : this._routineService.update(this._id()!, payload);

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
    const id = this._id();
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
