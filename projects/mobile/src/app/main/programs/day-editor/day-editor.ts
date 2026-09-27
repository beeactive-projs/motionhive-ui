import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonNote,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, PrescribedExercise, Program, ProgramService, ProgramWorkout } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../../workouts/_components/exercise-card/exercise-card';
import { DEFAULT_SETS } from '../../workouts/workouts.config';
import { PROGRAM_ICONS, dayLabel, weekLabel } from '../programs.config';

/**
 * One day of a program — the same job the routine builder does, over the
 * program's nested API rather than the routine service's flattened view.
 *
 * Deliberately not the routine-builder component reused literally: a routine
 * writes through `RoutineService` (one implied workout, exercises flattened)
 * while a day writes through `ProgramService` at
 * `programs/:id/workouts/:workoutId/exercises`. Same screen to a coach, two
 * different shapes underneath, and pretending otherwise is how the concepts
 * get mixed. The exercise card they share is the one piece that is the same.
 */
@Component({
  selector: 'mh-day-editor',
  imports: [
    ConfirmSheet,
    EmptyState,
    ExerciseCard,
    ExercisePickerSheet,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonNote,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './day-editor.html',
  styleUrl: './day-editor.scss',
})
export class DayEditor implements ViewWillEnter, ViewWillLeave {
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

  readonly skeletonCards = [1, 2];

  readonly program = signal<Program | null>(null);
  readonly workout = signal<ProgramWorkout | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly pickerOpen = signal(false);
  readonly removeTarget = signal<PrescribedExercise | null>(null);
  readonly removeOpen = signal(false);

  readonly name = signal('');
  readonly note = signal('');

  private _programId: string | null = null;
  private _workoutId: string | null = null;
  /**
   * Whether name and note have been seeded from the server for this day.
   * `load` re-runs after every exercise change to refresh the list, and
   * re-seeding the fields then threw away whatever the user had typed but
   * not yet saved — a renamed day snapped back to "Day 4" on adding an
   * exercise. The fields are filled once per day, then left alone.
   */
  private _fieldsSeeded = false;
  /** Name and note as the server last confirmed them, so a blur that changed nothing writes nothing. */
  private _saved = { name: '', note: '' };
  private _pendingSave: Promise<boolean> | null = null;

  readonly showSkeleton = computed(() => this.loading() && !this.workout());
  readonly showError = computed(
    () => !this.loading() && !this.workout() && (this.error() || !!this.program()),
  );

  /** Where back lands when there is no stack to pop — a reload, a deep link. */
  readonly builderUrl = computed(() => {
    const id = this.program()?.id;
    return id ? `/tabs/programs/program/${id}` : '/tabs/programs';
  });

  readonly eyebrow = computed(() => {
    const workout = this.workout();
    if (!workout) return '';
    return `${weekLabel(workout.weekIndex)} · ${dayLabel(workout.dayIndex)}`;
  });

  readonly exercises = computed<PrescribedExercise[]>(
    () => this.workout()?.exercises ?? [],
  );

  readonly addedIds = computed(() => this.exercises().map((e) => e.exerciseId));

  readonly removeBody = computed(() => {
    const row = this.removeTarget();
    return row ? `Remove ${this.exerciseName(row)} from this day?` : '';
  });

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const programId = this._route.snapshot.paramMap.get('id');
    const workoutId = this._route.snapshot.paramMap.get('workoutId');
    if (!programId || !workoutId) return;
    if (programId === this._programId && workoutId === this._workoutId) return;

    this._programId = programId;
    this._workoutId = workoutId;
    this._fieldsSeeded = false;
    this.load();
  }

  /**
   * Leaving by the back button must not lose a rename. Everything else on
   * this screen saves as it happens; name and note do the same on blur,
   * with the leave hook catching a field still focused on the way out.
   */
  ionViewWillLeave(): void {
    void this.saveFields();
  }

  exerciseName(row: PrescribedExercise): string {
    return row.exercise?.name ?? 'Exercise';
  }

  setsLabel(row: PrescribedExercise): string {
    const n = (row.sets ?? []).length;
    return `${n} ${n === 1 ? 'set' : 'sets'}`;
  }

  // ─── Editing ──────────────────────────────────────────────────

  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !picked.length) return;

    // `defaultSets` has the server create the empty sets with the
    // exercise: one request per movement, not one per set. A day with
    // nothing prescribed under its movements is not a day.
    this.saving.set(true);
    forkJoin(
      picked.map((exercise) =>
        this._programService
          .addExercise(programId, workoutId, {
            exerciseId: exercise.id,
            defaultSets: DEFAULT_SETS,
          })
          .pipe(catchError((err: unknown) => of(err))),
      ),
    )
      .pipe(take(1))
      .subscribe((results) => {
        this.saving.set(false);
        const failure = results.find((r) => !(r as PrescribedExercise)?.id);
        if (failure) void this._feedbackService.error(failure, 'Some exercises were not added');
        this.load();
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
      .subscribe(() => this.load());
  }

  openExercise(row: PrescribedExercise): void {
    void this._router.navigate(['/tabs/workouts/exercise', row.exerciseId]);
  }

  /**
   * Write name and note if they differ from what the server has. Resolves
   * to whether the day is now saved; a save already in flight is awaited
   * rather than duplicated.
   */
  saveFields(): Promise<boolean> {
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !this._fieldsSeeded) return Promise.resolve(true);

    const name = this.name().trim() || 'Untitled day';
    const note = this.note().trim();
    if (name === this._saved.name && note === this._saved.note) {
      return this._pendingSave ?? Promise.resolve(true);
    }

    const previous = this._saved;
    this._saved = { name, note };
    this._pendingSave = firstValueFrom(
      this._programService.updateWorkout(programId, workoutId, { name, notes: note }),
    )
      .then(() => true)
      .catch((err: unknown) => {
        this._saved = previous;
        void this._feedbackService.error(err, 'Could not save the day');
        return false;
      })
      .finally(() => {
        this._pendingSave = null;
      });
    return this._pendingSave;
  }

  async done(): Promise<void> {
    const programId = this._programId;
    if (!programId) return;

    this.saving.set(true);
    const saved = await this.saveFields();
    this.saving.set(false);
    // Back to the week card this came from, not the library — but only
    // with the day saved; leaving on a failed save is how a rename is lost.
    if (saved) void this._router.navigate(['/tabs/programs/program', programId]);
  }

  load(): void {
    const programId = this._programId;
    if (!programId) return;
    this.loading.set(true);
    this.error.set(false);

    this._programService
      .get(programId)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.program.set(program);
          const day = (program.workouts ?? []).find((w) => w.id === this._workoutId) ?? null;
          this.workout.set(day);
          if (day && !this._fieldsSeeded) {
            this.name.set(day.name);
            this.note.set(day.notes ?? '');
            this._saved = { name: day.name, note: day.notes ?? '' };
            this._fieldsSeeded = true;
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
