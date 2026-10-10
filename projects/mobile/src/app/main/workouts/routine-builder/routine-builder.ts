import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  CreateRoutineExercisePayload,
  Exercise,
  ExerciseKind,
  Routine,
  RoutineService,
  RoutineSources,
  dayDividerLabel,
  localDayKey,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { levelLabel } from '../../exercises/exercises.config';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import { OverviewExercise, WorkoutOverview } from '../_components/workout-overview/workout-overview';
import {
  DEFAULT_SETS,
  KeypadField,
  KeypadFields,
  WORKOUT_ICONS,
  formatMeasure,
  prescriptionLine,
} from '../workouts.config';

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
 * is whether the save is a create or an update.
 *
 * A saved routine opens read first, in the same overview a plan's day uses,
 * with Start as the one ask and Edit as a quiet text action that swaps the
 * builder in. A starter only ever reads: runnable and copyable, never
 * editable.
 */
@Component({
  selector: 'mh-routine-builder',
  imports: [
    ConfirmSheet,
    EmptyState,
    ExerciseCard,
    ExercisePickerSheet,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
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
    TranslatePipe,
    WorkoutOverview,
  ],
  templateUrl: './routine-builder.html',
  styleUrl: './routine-builder.scss',
})
export class RoutineBuilder implements ViewWillEnter {
  private readonly _routineService = inject(RoutineService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _activeWorkoutService = inject(ActiveWorkoutService);
  private readonly _translateService = inject(TranslateService);

  readonly Targets = TargetFields;
  readonly skeletonRows = [1, 2, 3, 4];

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
  /** A saved routine reads until Edit is tapped. */
  readonly editMode = signal(false);

  /** The target cell the keypad is editing, or null when it is closed. */
  readonly editing = signal<TargetEdit | null>(null);
  readonly draft = signal('');
  /** What the keypad has typed so far, echoed into the open target cell. */
  readonly typed = signal('');

  /** Read when focus jumps to another target, so what was typed is kept. */
  private readonly _keypad = viewChild(NumericKeypad);

  /** Identifies the open target for the keypad, so it re-seeds on every move. */
  readonly editingKey = computed(() => {
    const edit = this.editing();
    return edit ? `${edit.index}:${edit.field}` : '';
  });

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

  /** The read view: any saved routine, unless you are editing your own. */
  readonly showOverview = computed(
    () => !this.isNew() && !!this.routine() && (this.readOnly() || !this.editMode()),
  );

  /** Editing a routine that already exists — Cancel puts it back. */
  readonly editingSaved = computed(() => !this.isNew() && this.editMode() && !this.readOnly());

  readonly title = computed(() => {
    if (this.isNew()) return this._translateService.instant('workouts.common.newRoutine');
    // The overview carries the name as its heading; the bar names the kind of page.
    if (this.showOverview()) return this._translateService.instant('workouts.routineBuilder.title');
    return this.routine()?.name ?? this._translateService.instant('workouts.routineBuilder.title');
  });

  /** Whose it is, or when you last did it — the fact that places it. */
  readonly eyebrow = computed(() => {
    const routine = this.routine();
    if (!routine) return null;
    if (this.readOnly()) return this._translateService.instant('workouts.routineView.starter');
    return routine.lastPerformedAt
      ? this._translateService.instant('workouts.routineRow.lastDone', {
          day: dayDividerLabel(localDayKey(new Date(routine.lastPerformedAt))),
        })
      : this._translateService.instant('workouts.routineView.yours');
  });

  readonly chips = computed(() => {
    const routine = this.routine();
    if (!routine) return [];
    const chips: string[] = [
      this._translateService.instant('count.exercises', { count: routine.exerciseCount }),
    ];
    if (routine.level) chips.push(levelLabel(routine.level));
    return chips;
  });

  readonly noteLabel = computed(() =>
    this._translateService.instant(
      this.readOnly() ? 'workouts.routineView.about' : 'workouts.routineView.notes',
    ),
  );

  /**
   * The saved routine, not the draft: the overview shows what Start will run.
   * A routine saved by the simple editor may carry only the flat summary, so
   * that stands in for the per-set rows when there are none.
   */
  readonly overviewExercises = computed<OverviewExercise[]>(() =>
    (this.routine()?.exercises ?? []).map((e) => ({
      key: e.id,
      exercise: {
        id: e.exerciseId,
        name: e.exercise?.name ?? this._translateService.instant('workouts.common.exercise'),
        kind: (e.exercise?.kind as ExerciseKind | undefined) ?? ExerciseKind.Strength,
        thumbnailUrl: e.exercise?.thumbnailUrl ?? null,
      },
      prescription: prescriptionLine(
        e.sets.length
          ? e.sets
          : Array.from({ length: e.defaultSets || DEFAULT_SETS }, () => ({
              targetRepsMin: e.targetRepsMin,
              targetRepsMax: e.targetRepsMax,
              targetWeightKg: e.targetWeightKg,
              targetDurationSeconds: null,
            })),
      ),
    })),
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
    return this._translateService.instant(
      edit.field === TargetFields.Weight
        ? 'workouts.routineBuilder.targets.weightKeypad'
        : 'workouts.routineBuilder.targets.repsKeypad',
    );
  });

  /** What the picker should already show as taken. */
  readonly addedIds = computed(() => this.exercises().map((row) => row.exerciseId));

  readonly deleteBody = computed(() => {
    const name =
      this.routine()?.name ??
      this._translateService.instant('workouts.routineBuilder.thisRoutine');
    return this._translateService.instant('workouts.routineBuilder.delete.message', { name });
  });

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
    this.editMode.set(false);
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
          this._resetDraft(routine);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  // ─── Editing ──────────────────────────────────────────────────

  edit(): void {
    if (this.readOnly()) return;
    this.editMode.set(true);
  }

  /** Drops the draft and returns to the read view of what is saved. */
  cancelEdit(): void {
    const routine = this.routine();
    if (routine) this._resetDraft(routine);
    this.editing.set(null);
    this.pickerOpen.set(false);
    this.editMode.set(false);
  }

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
        this._translateService.instant('workouts.routineBuilder.toast.alreadyIn', {
          count: skipped,
        }),
      );
    }
  }

  /** The catalog page, pushed onto this stack so the draft survives. */
  openExercise(row: DraftExercise): void {
    this.openExerciseById(row.exerciseId);
  }

  openExerciseById(exerciseId: string): void {
    void this._router.navigate(['/tabs/workouts/exercise', exerciseId]);
  }

  setCount(index: number, delta: number): void {
    this.exercises.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, sets: Math.max(1, row.sets + delta) } : row)),
    );
  }

  setsLabel(row: DraftExercise): string {
    return this._translateService.instant('count.sets', { count: row.sets });
  }

  remove(index: number): void {
    this.exercises.update((rows) => rows.filter((_, i) => i !== index));
  }

  // ─── Targets ──────────────────────────────────────────────────

  editTarget(index: number, field: TargetField): void {
    // Tapping another target is a Done for this one: what was typed stays.
    const keypad = this._keypad();
    if (this.editing() && keypad) this._applyTarget(keypad.committed());
    this.typed.set('');
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
    this._applyTarget(typed);
    this.editing.set(null);
  }

  private _applyTarget(typed: string): void {
    const edit = this.editing();
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
      return row.targetWeightKg == null ? '–' : formatMeasure(row.targetWeightKg);
    }
    const { targetRepsMin: min, targetRepsMax: max } = row;
    if (min == null && max == null) return '–';
    if (min != null && max != null && min !== max) return `${min}-${max}`;
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

    const creating = this.isNew();
    const request = creating
      ? this._routineService.create(payload)
      : this._routineService.update(this._id()!, payload);

    request.pipe(take(1)).subscribe({
      next: () => {
        this.saving.set(false);
        void this._feedbackService.success(
          this._translateService.instant('workouts.routineBuilder.toast.saved'),
        );
        if (creating) {
          void this._router.navigate(['/tabs/workouts']);
          return;
        }
        // An edit lands back on the read view, showing what was just saved.
        this.editing.set(null);
        this.editMode.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        void this._feedbackService.error(
          err,
          this._translateService.instant('workouts.routineBuilder.toast.saveFailed'),
        );
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
          void this._feedbackService.success(
            this._translateService.instant('workouts.routineBuilder.toast.deleted'),
          );
          void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
        },
        error: (err) => {
          this.deleting.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.routineBuilder.toast.deleteFailed'),
          );
        },
      });
  }

  /** Starting a starter deep-copies it into your library, server-side. */
  start(): void {
    const id = this._id();
    if (!id || id === NEW || this.starting()) return;

    this.starting.set(true);
    this._activeWorkoutService.startOrResume(() => this._start(id), {
      onBlocked: () => this.starting.set(false),
    });
  }

  private _start(id: string): void {
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
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.routineBuilder.toast.startFailed'),
          );
        },
      });
  }

  /** The builder's rows, rebuilt from what is saved. */
  private _resetDraft(routine: Routine): void {
    this.name.set(routine.name);
    this.exercises.set(
      (routine.exercises ?? []).map((e) => ({
        key: e.id,
        exerciseId: e.exerciseId,
        name: e.exercise?.name ?? this._translateService.instant('workouts.common.exercise'),
        sets: e.defaultSets || DEFAULT_SETS,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetWeightKg: e.targetWeightKg,
      })),
    );
  }
}
