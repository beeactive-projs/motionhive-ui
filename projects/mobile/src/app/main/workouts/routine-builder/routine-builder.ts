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
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  CreateRoutineExercisePayload,
  Exercise,
  Routine,
  RoutineService,
  RoutineSources,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import { DEFAULT_SETS, KeypadField, KeypadFields, WORKOUT_ICONS } from '../workouts.config';

/** The two targets a routine prescribes per exercise. */
const TargetFields = {
  Reps: 'reps',
  Weight: 'weight',
} as const;

type TargetField = (typeof TargetFields)[keyof typeof TargetFields];

/** Which target cell the keypad is bound to. */
interface TargetEdit {
  index: number;
  field: TargetField;
}

/** A row being authored, before it is a saved routine. */
interface DraftExercise {
  /** Stable across re-renders; the exercise id is unique per routine. */
  key: string;
  exerciseId: string;
  name: string;
  sets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
}

/** The URL segment that means "a routine that does not exist yet". */
const NEW = 'new';

/**
 * The routine builder — the logger without a stopwatch.
 *
 * Uses the same exercise picker the live logger uses, so adding an exercise
 * is one learned gesture rather than two. Targets are optional here for the
 * same reason actuals are optional there: a routine that only names the
 * movements in order is still a useful routine.
 *
 * Handles `new` and an existing id on the same screen — the only difference
 * is whether the save is a create or an update. A starter opens here too,
 * read-only: runnable and copyable, never editable.
 */
@Component({
  selector: 'mh-routine-builder',
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
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NumericKeypad,
  ],
  templateUrl: './routine-builder.html',
  styleUrl: './routine-builder.scss',
})
export class RoutineBuilder implements ViewWillEnter {
  private readonly _routineService = inject(RoutineService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

  readonly Targets = TargetFields;
  readonly skeletonCards = [1, 2];

  readonly routine = signal<Routine | null>(null);
  readonly name = signal('');
  readonly exercises = signal<DraftExercise[]>([]);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly pickerOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  /** The target cell the keypad is editing, or null when it is closed. */
  readonly editing = signal<TargetEdit | null>(null);
  readonly draft = signal('');

  /**
   * A signal, not a field: `isNew` is a computed over it, and a computed
   * cannot see a plain property change.
   */
  private readonly _id = signal<string | null>(null);

  readonly isNew = computed(() => {
    const id = this._id();
    return id === NEW || id === null;
  });

  readonly showSkeleton = computed(() => this.loading() && !this.routine());
  readonly showError = computed(() => this.error() && !this.routine());

  /** A starter belongs to nobody: runnable and copyable, never editable. */
  readonly readOnly = computed(() => this.routine()?.source === RoutineSources.System);

  readonly title = computed(() =>
    this.isNew() ? 'New routine' : (this.routine()?.name ?? 'Routine'),
  );

  readonly canSave = computed(
    () => !!this.name().trim() && this.exercises().length > 0 && !this.readOnly(),
  );

  readonly keypadField = computed<KeypadField>(() =>
    this.editing()?.field === TargetFields.Weight ? KeypadFields.Weight : KeypadFields.Reps,
  );

  readonly keypadLabel = computed(() => {
    const edit = this.editing();
    if (!edit) return '';
    return edit.field === TargetFields.Weight ? 'Target weight (kg)' : 'Target reps';
  });

  /** What the picker should already show as taken. */
  readonly addedIds = computed(() => this.exercises().map((row) => row.exerciseId));

  readonly deleteBody = computed(
    () =>
      `Delete ${this.routine()?.name ?? 'this routine'}? Workouts already logged from it are kept.`,
  );

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');

    // `new` is not an identity. Two visits to it are two different routines,
    // so it always starts clean — guarding on equality here is what left the
    // previous routine's name and exercises sitting in the form.
    if (!id || id === NEW) {
      this._id.set(NEW);
      this.routine.set(null);
      this.name.set('');
      this.exercises.set([]);
      this.pickerOpen.set(false);
      return;
    }

    if (id === this._id()) return;
    this._id.set(id);
    this.load();
  }

  load(): void {
    const id = this._id();
    if (!id || id === NEW) return;

    this.loading.set(true);
    this.error.set(false);
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
              targetWeightKg: e.targetWeightKg,
            })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  // ─── Editing ──────────────────────────────────────────────────

  /**
   * Adds the picked movements, skipping any already in the routine. Adding
   * the same exercise twice by accident is far more common than wanting it
   * twice on purpose — and wanting more of it is what the sets stepper is for.
   */
  onPicked(picked: Exercise[]): void {
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
          targetWeightKg: null,
        })),
      ]);
    }

    if (skipped > 0) {
      void this._feedbackService.info(
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
      rows.map((row, i) => (i === index ? { ...row, sets: Math.max(1, row.sets + delta) } : row)),
    );
  }

  setsLabel(row: DraftExercise): string {
    return `${row.sets} ${row.sets === 1 ? 'set' : 'sets'}`;
  }

  remove(index: number): void {
    this.exercises.update((rows) => rows.filter((_, i) => i !== index));
  }

  // ─── Targets ──────────────────────────────────────────────────

  editTarget(index: number, field: TargetField): void {
    this.editing.set({ index, field });
    const row = this.exercises()[index];
    const current = field === TargetFields.Weight ? row?.targetWeightKg : row?.targetRepsMin;
    this.draft.set(current == null ? '' : String(current));
  }

  isEditing(index: number, field: TargetField): boolean {
    const edit = this.editing();
    return edit?.index === index && edit.field === field;
  }

  commitTarget(typed: string): void {
    const edit = this.editing();
    this.editing.set(null);
    if (!edit) return;

    const raw = typed.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;

    this.exercises.update((rows) =>
      rows.map((row, i) => {
        if (i !== edit.index) return row;
        // Reps are stored as a range; a single number is a range of one,
        // which is what the flat summary on the exercise means.
        return edit.field === TargetFields.Weight
          ? { ...row, targetWeightKg: value }
          : { ...row, targetRepsMin: value, targetRepsMax: value };
      }),
    );
  }

  targetLabel(row: DraftExercise, field: TargetField): string {
    if (field === TargetFields.Weight) {
      return row.targetWeightKg == null ? '–' : `${row.targetWeightKg}`;
    }
    const { targetRepsMin: min, targetRepsMax: max } = row;
    if (min == null && max == null) return '–';
    if (min != null && max != null && min !== max) return `${min}–${max}`;
    return `${min ?? max}`;
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
        ...(row.targetWeightKg != null ? { targetWeightKg: row.targetWeightKg } : {}),
      })),
    };

    const request = this.isNew()
      ? this._routineService.create(payload)
      : this._routineService.update(this._id()!, payload);

    request.pipe(take(1)).subscribe({
      next: () => {
        this.saving.set(false);
        void this._feedbackService.success('Routine saved');
        void this._router.navigate(['/tabs/workouts']);
      },
      error: (err) => {
        this.saving.set(false);
        void this._feedbackService.error(err, 'Could not save the routine');
      },
    });
  }

  /** Nothing else can remove a routine, so this is the only way out. */
  confirmDelete(): void {
    const id = this._id();
    if (!id || id === NEW || this.deleting()) return;
    this.deleting.set(true);
    this._routineService
      .remove(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteOpen.set(false);
          void this._feedbackService.success('Routine deleted');
          void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
        },
        error: (err) => {
          this.deleting.set(false);
          void this._feedbackService.error(err, 'Could not delete the routine');
        },
      });
  }

  /** Starting a starter deep-copies it into your library, server-side. */
  start(): void {
    const id = this._id();
    if (!id || id === NEW || this.starting()) return;

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
          void this._feedbackService.error(err, 'Could not start that routine');
        },
      });
  }
}
