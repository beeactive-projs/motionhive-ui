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
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

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

interface SelectOption<T> {
  value: T;
  label: string;
}

/**
 * Create / edit a prescribed set inside an exercise (FE-P2e).
 *
 * V1 surfaces the most-used fields — set type, reps range, weight (kg),
 * rest, optional notes. RPE/RIR/percent_1rm/duration/distance/tempo are
 * BE-supported but hidden behind an "Advanced" toggle to keep the
 * default form scannable.
 */
@Component({
  selector: 'mh-set-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    Dialog,
    InputNumber,
    Select,
    TextareaModule,
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
  readonly saved = output<PrescribedSet>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);

  readonly submitting = signal(false);
  readonly showAdvanced = signal(false);

  // ── Core fields ──────────────────────────────────────────────────

  readonly setType = signal<ExerciseSetType>(ExerciseSetType.Normal);
  readonly repsMin = signal<number | null>(null);
  readonly repsMax = signal<number | null>(null);
  readonly weightKg = signal<number | null>(null);
  readonly restSeconds = signal<number | null>(null);
  readonly notes = signal<string>('');

  // ── Advanced fields ──────────────────────────────────────────────

  readonly weightPercent1rm = signal<number | null>(null);
  readonly durationSeconds = signal<number | null>(null);
  readonly distanceMeters = signal<number | null>(null);
  readonly rpe = signal<number | null>(null);
  readonly rir = signal<number | null>(null);
  readonly tempo = signal<string>('');

  // ── Options ──────────────────────────────────────────────────────

  readonly setTypeOptions: SelectOption<ExerciseSetType>[] = [
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
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Add set',
  );
  readonly canSubmit = computed(() => !this.submitting());

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
    if (!this.canSubmit()) return;

    const min = this.repsMin();
    const max = this.repsMax();
    const payload: CreatePrescribedSetPayload = {
      setType: this.setType(),
      ...(min != null ? { targetRepsMin: min } : {}),
      ...(max != null ? { targetRepsMax: max } : {}),
      ...(this.weightKg() != null
        ? { targetWeightKg: this.weightKg() as number }
        : {}),
      ...(this.restSeconds() != null
        ? { restAfterSeconds: this.restSeconds() as number }
        : {}),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      ...(this.weightPercent1rm() != null
        ? { targetWeightPercent1rm: this.weightPercent1rm() as number }
        : {}),
      ...(this.durationSeconds() != null
        ? { targetDurationSeconds: this.durationSeconds() as number }
        : {}),
      ...(this.distanceMeters() != null
        ? { targetDistanceMeters: this.distanceMeters() as number }
        : {}),
      ...(this.rpe() != null ? { targetRpe: this.rpe() as number } : {}),
      ...(this.rir() != null ? { targetRir: this.rir() as number } : {}),
      ...(this.tempo().trim() ? { tempo: this.tempo().trim() } : {}),
    };

    this.submitting.set(true);
    const existing = this.set();
    const req$ = existing
      ? this._programService.updateSet(
          this.program().id,
          this.workout().id,
          this.exercise().id,
          existing.id,
          payload as UpdatePrescribedSetPayload,
        )
      : this._programService.addSet(
          this.program().id,
          this.workout().id,
          this.exercise().id,
          payload,
        );

    req$.subscribe({
      next: (s) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Set updated' : 'Set added',
          life: 2000,
        });
        this.saved.emit(s);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          existing ? "Couldn't save set" : "Couldn't add set",
          'Please check the form and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(): void {
    const s = this.set();
    if (s) {
      this.setType.set(s.setType);
      this.repsMin.set(s.targetRepsMin);
      this.repsMax.set(s.targetRepsMax);
      this.weightKg.set(s.targetWeightKg);
      this.restSeconds.set(s.restAfterSeconds);
      this.notes.set(s.notes ?? '');
      this.weightPercent1rm.set(s.targetWeightPercent1rm);
      this.durationSeconds.set(s.targetDurationSeconds);
      this.distanceMeters.set(s.targetDistanceMeters);
      this.rpe.set(s.targetRpe);
      this.rir.set(s.targetRir);
      this.tempo.set(s.tempo ?? '');
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
      this.setType.set(ExerciseSetType.Normal);
      this.repsMin.set(null);
      this.repsMax.set(null);
      this.weightKg.set(null);
      this.restSeconds.set(null);
      this.notes.set('');
      this.weightPercent1rm.set(null);
      this.durationSeconds.set(null);
      this.distanceMeters.set(null);
      this.rpe.set(null);
      this.rir.set(null);
      this.tempo.set('');
      this.showAdvanced.set(false);
    }
  }
}
