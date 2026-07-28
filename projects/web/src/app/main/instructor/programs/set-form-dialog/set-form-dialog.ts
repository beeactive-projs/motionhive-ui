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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { from } from 'rxjs';
import { concatMap, tap } from 'rxjs/operators';

import {
  CreatePrescribedSetPayload,
  ExerciseSetType,
  PrescribedExercise,
  PrescribedSet,
  Program,
  ProgramService,
  ProgramWorkout,
  UpdatePrescribedSetPayload,
  showApiError,
} from 'core';

/** BE rejects any other shape (`Matches(/^\d-\d-\d-\d$/)` on the DTO). */
const TEMPO_PATTERN = /^\d-\d-\d-\d$/;

/** Cross-field: both reps bounds filled but inverted. */
const repsRangeValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const min = group.get('repsMin')?.value;
  const max = group.get('repsMax')?.value;
  return min != null && max != null && min > max ? { repsRange: true } : null;
};

/**
 * Create / edit a prescribed set inside an exercise (FE-P2e).
 *
 * V1 surfaces the most-used fields — set type, reps range, weight (kg),
 * rest, optional notes. RPE/RIR/percent_1rm/duration/distance/tempo are
 * BE-supported but hidden behind an "Advanced" toggle to keep the
 * default form scannable.
 *
 * Create mode has a "Number of sets" count: one submit POSTs N
 * identical sets sequentially (no bulk endpoint on the BE; sequential
 * keeps the BE's `orderIndex = max + 1` assignment race-free).
 */
@Component({
  selector: 'mh-set-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    InputText,
    Message,
    Select,
    Textarea,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './set-form-dialog.html',
  styleUrl: './set-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetFormDialog {
  readonly program = input.required<Program>();
  readonly workout = input.required<ProgramWorkout>();
  readonly exercise = input.required<PrescribedExercise>();
  /** When set → edit mode. When null → create mode. */
  readonly set = input<PrescribedSet | null>(null);
  readonly visible = model<boolean>(false);
  /** All sets touched by one submit — N created rows, or the edited one. */
  readonly saved = output<PrescribedSet[]>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly showAdvanced = signal(false);

  // ── Form ─────────────────────────────────────────────────────────
  // `numberOfSets` is create-mode only (not rendered in edit) — one
  // submit POSTs that many identical sets.

  readonly form = this._formBuilder.nonNullable.group(
    {
      numberOfSets: [1 as number | null],
      setType: [ExerciseSetType.Normal as ExerciseSetType],
      repsMin: [null as number | null],
      repsMax: [null as number | null],
      weightKg: [null as number | null],
      restSeconds: [null as number | null],
      notes: [''],
      weightPercent1rm: [null as number | null],
      durationSeconds: [null as number | null],
      distanceMeters: [null as number | null],
      rpe: [null as number | null],
      rir: [null as number | null],
      tempo: ['', Validators.pattern(TEMPO_PATTERN)],
    },
    { validators: repsRangeValidator },
  );

  // ── Options ──────────────────────────────────────────────────────

  readonly setTypeOptions: SelectItem<ExerciseSetType>[] = [
    { value: ExerciseSetType.Normal, label: 'Normal' },
    { value: ExerciseSetType.Warmup, label: 'Warm-up' },
    { value: ExerciseSetType.Working, label: 'Working' },
    { value: ExerciseSetType.Dropset, label: 'Drop set' },
    { value: ExerciseSetType.Failure, label: 'To failure' },
    { value: ExerciseSetType.Amrap, label: 'AMRAP' },
    { value: ExerciseSetType.RestPause, label: 'Rest-pause' },
    { value: ExerciseSetType.Cluster, label: 'Cluster' },
  ];

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEdit = computed(() => this.set() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit set' : 'Add set',
  );

  submitLabel(): string {
    if (this.isEdit()) return 'Save changes';
    const n = this.form.controls.numberOfSets.value ?? 1;
    return n > 1 ? `Add ${n} sets` : 'Add set';
  }

  // ── Validation ───────────────────────────────────────────────────
  // A disabled submit button fails silently — instead the button stays
  // clickable and an invalid submit marks everything touched so the
  // inline errors surface.

  /** Cross-field: shown live — both fields filled is an intentional range. */
  repsRangeError(): string | null {
    return this.form.errors?.['repsRange']
      ? "Min reps can't exceed max reps."
      : null;
  }

  isFieldInvalid(field: 'tempo'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  getFieldError(field: 'tempo'): string {
    const errors = this.form.controls[field].errors;
    if (errors?.['pattern'])
      return 'Tempo must be four dash-separated digits, e.g. 3-1-1-0.';
    return '';
  }

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

  toggleAdvanced(): void {
    this.showAdvanced.update((v) => !v);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // The tempo field lives behind the Advanced toggle — reveal it so
      // the inline error can't be hidden.
      if (this.form.controls.tempo.invalid) this.showAdvanced.set(true);
      return;
    }

    const value = this.form.getRawValue();
    const payload: CreatePrescribedSetPayload = {
      setType: value.setType,
      ...(value.repsMin != null ? { targetRepsMin: value.repsMin } : {}),
      ...(value.repsMax != null ? { targetRepsMax: value.repsMax } : {}),
      ...(value.weightKg != null ? { targetWeightKg: value.weightKg } : {}),
      ...(value.restSeconds != null
        ? { restAfterSeconds: value.restSeconds }
        : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      ...(value.weightPercent1rm != null
        ? { targetWeightPercent1rm: value.weightPercent1rm }
        : {}),
      ...(value.durationSeconds != null
        ? { targetDurationSeconds: value.durationSeconds }
        : {}),
      ...(value.distanceMeters != null
        ? { targetDistanceMeters: value.distanceMeters }
        : {}),
      ...(value.rpe != null ? { targetRpe: value.rpe } : {}),
      ...(value.rir != null ? { targetRir: value.rir } : {}),
      ...(value.tempo.trim() ? { tempo: value.tempo.trim() } : {}),
    };

    this.submitting.set(true);
    const existing = this.set();

    if (existing) {
      this._programService
        .updateSet(
          this.program().id,
          this.workout().id,
          this.exercise().id,
          existing.id,
          payload as UpdatePrescribedSetPayload,
        )
        .subscribe({
          next: (s) => {
            this.submitting.set(false);
            this._messageService.add({
              severity: 'success',
              summary: 'Set updated',
              life: 2000,
            });
            this.saved.emit([s]);
            this.visible.set(false);
          },
          error: (err) => {
            this.submitting.set(false);
            showApiError(
              this._messageService,
              "Couldn't save set",
              'Please check the form and try again.',
              err,
            );
          },
        });
      return;
    }

    // Create mode — N identical sets, sequentially (see class doc).
    const count = Math.max(1, Math.min(20, value.numberOfSets ?? 1));
    const created: PrescribedSet[] = [];
    from(Array.from({ length: count }))
      .pipe(
        concatMap(() =>
          this._programService
            .addSet(
              this.program().id,
              this.workout().id,
              this.exercise().id,
              payload,
            )
            .pipe(tap((s) => created.push(s))),
        ),
      )
      .subscribe({
        complete: () => {
          this.submitting.set(false);
          this._messageService.add({
            severity: 'success',
            summary:
              created.length === 1
                ? 'Set added'
                : `${created.length} sets added`,
            life: 2000,
          });
          this.saved.emit([...created]);
          this.visible.set(false);
        },
        error: (err) => {
          this.submitting.set(false);
          // Keep the dialog open so the user can adjust the count and
          // retry; what did land is emitted so the parent stays in sync.
          if (created.length > 0) this.saved.emit([...created]);
          showApiError(
            this._messageService,
            "Couldn't add all sets",
            created.length > 0
              ? `${created.length} of ${count} sets were added before the error.`
              : 'Please check the form and try again.',
            err,
          );
        },
      });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(): void {
    const s = this.set();
    if (s) {
      this.form.reset({
        numberOfSets: 1,
        setType: s.setType,
        repsMin: s.targetRepsMin,
        repsMax: s.targetRepsMax,
        weightKg: s.targetWeightKg,
        restSeconds: s.restAfterSeconds,
        notes: s.notes ?? '',
        weightPercent1rm: s.targetWeightPercent1rm,
        durationSeconds: s.targetDurationSeconds,
        distanceMeters: s.targetDistanceMeters,
        rpe: s.targetRpe,
        rir: s.targetRir,
        tempo: s.tempo ?? '',
      });
      // Auto-expand advanced if the set already uses any advanced field.
      this.showAdvanced.set(
        s.targetWeightPercent1rm != null ||
          s.targetDurationSeconds != null ||
          s.targetDistanceMeters != null ||
          s.targetRpe != null ||
          s.targetRir != null ||
          !!s.tempo,
      );
    } else {
      this.form.reset();
      this.showAdvanced.set(false);
    }
  }
}
