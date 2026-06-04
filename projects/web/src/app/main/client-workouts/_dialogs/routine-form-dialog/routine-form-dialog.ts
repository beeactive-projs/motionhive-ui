import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  CreateRoutineExercisePayload,
  CreateRoutinePayload,
  Exercise,
  Routine,
  RoutineExercise,
  RoutineService,
  showApiError,
} from 'core';

import { ExercisePickerDialog } from '../../../instructor/programs/exercise-picker-dialog/exercise-picker-dialog';

interface DraftExercise {
  /** Stable client-side id (so removing pre-save rows works without an id). */
  uiKey: string;
  exerciseId: string;
  exerciseName: string;
  exerciseThumbnailUrl: string | null;
  defaultSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restAfterSeconds: number | null;
}

/**
 * Create / edit a Routine.
 *
 * Behaviour:
 *   - `routine = null` → create mode.
 *   - `routine != null` → edit mode; hydrates fields + exercises on open.
 *   - The exercises list is locally edited; on save the FE PATCHes the full
 *     payload (BE replaces the routine_exercise rows wholesale).
 *   - Picker is reused in emit-only mode (no BE hop), then we drop the
 *     chosen Exercise into the local draft list with sensible defaults
 *     (3 sets, no targets — author can tweak).
 */
@Component({
  selector: 'mh-routine-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    Dialog,
    InputNumber,
    InputTextModule,
    TextareaModule,
    Toast,
    TooltipModule,
    ExercisePickerDialog,
  ],
  providers: [MessageService],
  templateUrl: './routine-form-dialog.html',
  styleUrl: './routine-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutineFormDialog {
  readonly routine = input<Routine | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<Routine>();

  private readonly _service = inject(RoutineService);
  private readonly _messageService = inject(MessageService);

  readonly name = signal<string>('');
  readonly notes = signal<string>('');
  readonly folder = signal<string>('');
  readonly exercises = signal<DraftExercise[]>([]);
  readonly submitting = signal(false);
  readonly pickerOpen = signal(false);

  readonly isEdit = computed(() => this.routine() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit routine' : 'New routine',
  );
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Create routine',
  );
  readonly canSubmit = computed(
    () => this.name().trim().length >= 1 && !this.submitting(),
  );

  constructor() {
    effect(() => {
      if (this.visible()) this._hydrate();
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  onExercisePicked(ex: Exercise): void {
    const draft: DraftExercise = {
      uiKey: `new-${Date.now()}-${Math.floor(performance.now())}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      exerciseThumbnailUrl: ex.thumbnailUrl,
      defaultSets: 3,
      targetRepsMin: null,
      targetRepsMax: null,
      targetWeightKg: null,
      restAfterSeconds: null,
    };
    this.exercises.update((cur) => [...cur, draft]);
    this.pickerOpen.set(false);
  }

  removeExercise(uiKey: string): void {
    this.exercises.update((cur) => cur.filter((e) => e.uiKey !== uiKey));
  }

  moveUp(uiKey: string): void {
    const cur = this.exercises();
    const i = cur.findIndex((e) => e.uiKey === uiKey);
    if (i <= 0) return;
    const copy = [...cur];
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
    this.exercises.set(copy);
  }

  moveDown(uiKey: string): void {
    const cur = this.exercises();
    const i = cur.findIndex((e) => e.uiKey === uiKey);
    if (i < 0 || i >= cur.length - 1) return;
    const copy = [...cur];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    this.exercises.set(copy);
  }

  patchExercise(uiKey: string, patch: Partial<DraftExercise>): void {
    this.exercises.update((cur) =>
      cur.map((e) => (e.uiKey === uiKey ? { ...e, ...patch } : e)),
    );
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const payload: CreateRoutinePayload = {
      name: this.name().trim(),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      ...(this.folder().trim() ? { folder: this.folder().trim() } : {}),
      exercises: this.exercises().map((e) => this._toPayloadExercise(e)),
    };

    this.submitting.set(true);
    const existing = this.routine();
    const req$ = existing
      ? this._service.update(existing.id, payload)
      : this._service.create(payload);

    req$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Routine updated' : 'Routine created',
          detail: `${saved.name} is ready to use.`,
          life: 2500,
        });
        this.saved.emit(saved);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          existing ? "Couldn't save routine" : "Couldn't create routine",
          'Please check the form and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(): void {
    const r = this.routine();
    if (r) {
      this.name.set(r.name);
      this.notes.set(r.notes ?? '');
      this.folder.set(r.folder ?? '');
      this.exercises.set(
        (r.exercises ?? []).map((re) => this._toDraft(re)),
      );
    } else {
      this.name.set('');
      this.notes.set('');
      this.folder.set('');
      this.exercises.set([]);
    }
  }

  private _toDraft(re: RoutineExercise): DraftExercise {
    return {
      uiKey: re.id,
      exerciseId: re.exerciseId,
      exerciseName: re.exercise?.name ?? 'Exercise',
      exerciseThumbnailUrl: re.exercise?.thumbnailUrl ?? null,
      defaultSets: re.defaultSets,
      targetRepsMin: re.targetRepsMin,
      targetRepsMax: re.targetRepsMax,
      targetWeightKg: re.targetWeightKg,
      restAfterSeconds: re.restAfterSeconds,
    };
  }

  private _toPayloadExercise(
    d: DraftExercise,
  ): CreateRoutineExercisePayload {
    return {
      exerciseId: d.exerciseId,
      defaultSets: Math.max(1, Math.min(30, d.defaultSets ?? 3)),
      ...(d.targetRepsMin != null ? { targetRepsMin: d.targetRepsMin } : {}),
      ...(d.targetRepsMax != null ? { targetRepsMax: d.targetRepsMax } : {}),
      ...(d.targetWeightKg != null ? { targetWeightKg: d.targetWeightKg } : {}),
      ...(d.restAfterSeconds != null
        ? { restAfterSeconds: d.restAfterSeconds }
        : {}),
    };
  }
}
