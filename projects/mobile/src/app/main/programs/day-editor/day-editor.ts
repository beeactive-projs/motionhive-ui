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
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, PrescribedExercise, Program, ProgramService, ProgramWorkout } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { PROGRAM_ICONS } from '../programs.config';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_SETS = 3;

/**
 * One day of a program — the same job the routine builder does, over the
 * program's nested API rather than the routine service's flattened view.
 *
 * Deliberately not the routine-builder component reused literally: a routine
 * writes through `RoutineService` (one implied workout, exercises flattened)
 * while a day writes through `ProgramService` at
 * `programs/:id/workouts/:workoutId/exercises`. Same screen to a coach, two
 * different shapes underneath, and pretending otherwise is how the concepts
 * get mixed.
 */
@Component({
  selector: 'mh-day-editor',
  imports: [
    ConfirmSheet,
    ExercisePickerSheet,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './day-editor.html',
  styleUrl: './day-editor.scss',
})
export class DayEditor implements ViewWillEnter {
  private readonly _programService = inject(ProgramService);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly program = signal<Program | null>(null);
  readonly workout = signal<ProgramWorkout | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly pickerOpen = signal(false);
  readonly removeTarget = signal<PrescribedExercise | null>(null);
  readonly removeOpen = signal(false);

  readonly name = signal('');
  readonly note = signal('');

  private _programId: string | null = null;
  private _workoutId: string | null = null;

  readonly eyebrow = computed(() => {
    const w = this.workout();
    if (!w) return '';
    return `WEEK ${w.weekIndex + 1} · ${DAY_LABELS[w.dayIndex] ?? `DAY ${w.dayIndex + 1}`}`;
  });

  readonly exercises = computed<PrescribedExercise[]>(
    () => this.workout()?.exercises ?? [],
  );

  readonly addedIds = computed(() => this.exercises().map((e) => e.exerciseId));

  readonly removeBody = computed(() =>
    this.removeTarget()
      ? `Remove ${this.exerciseName(this.removeTarget()!)} from this day?`
      : '',
  );

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const parts = this._router.url.split('?')[0].split('/');
    const programId = parts[parts.indexOf('program') + 1] ?? null;
    const workoutId = parts[parts.indexOf('day') + 1] ?? null;
    if (!programId || !workoutId) return;
    if (programId === this._programId && workoutId === this._workoutId) return;

    this._programId = programId;
    this._workoutId = workoutId;
    this._load();
  }

  exerciseName(row: PrescribedExercise): string {
    return row.exercise?.name ?? 'Exercise';
  }

  setCount(row: PrescribedExercise): number {
    return (row.sets ?? []).length;
  }

  // ─── Editing ──────────────────────────────────────────────────

  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !picked.length) return;

    this.saving.set(true);
    forkJoin(
      picked.map((exercise) =>
        this._programService
          .addExercise(programId, workoutId, { exerciseId: exercise.id })
          .pipe(catchError(() => of(null))),
      ),
    )
      .pipe(take(1))
      .subscribe((added) => {
        const kept = added.filter((e): e is PrescribedExercise => !!e);
        if (!kept.length) {
          this.saving.set(false);
          this._load();
          return;
        }

        // The program API creates the exercise and no sets — unlike the
        // routine payload, which takes `defaultSets`. Without this a day
        // holds movements with nothing prescribed under them.
        forkJoin(
          kept.flatMap((row) =>
            Array.from({ length: DEFAULT_SETS }, () =>
              this._programService
                .addSet(programId, workoutId, row.id, {})
                .pipe(catchError(() => of(null))),
            ),
          ),
        )
          .pipe(take(1))
          .subscribe(() => {
            this.saving.set(false);
            this._load();
          });
      });
  }

  askRemove(row: PrescribedExercise): void {
    this.removeTarget.set(row);
    this.removeOpen.set(true);
  }

  confirmRemove(): void {
    const row = this.removeTarget();
    this.removeOpen.set(false);
    this.removeTarget.set(null);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!row || !programId || !workoutId) return;

    this._programService
      .removeExercise(programId, workoutId, row.id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => this._load());
  }

  openExercise(row: PrescribedExercise): void {
    void this._router.navigate(['/tabs/workouts/exercise', row.exerciseId]);
  }

  done(): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId) return;

    this.saving.set(true);
    this._programService
      .updateWorkout(programId, workoutId, {
        name: this.name().trim() || 'Untitled day',
        notes: this.note().trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          // Back to the week card this came from, not the library.
          void this._router.navigate(['/tabs/programs/program', programId]);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedback.error(err, 'Could not save the day');
        },
      });
  }

  private _load(): void {
    const programId = this._programId;
    if (!programId) return;
    this.loading.set(true);

    this._programService
      .get(programId)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.program.set(program);
          const day = (program.workouts ?? []).find((w) => w.id === this._workoutId) ?? null;
          this.workout.set(day);
          if (day) {
            this.name.set(day.name);
            this.note.set(day.notes ?? '');
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
