import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

import {
  CreateProgramWorkoutPayload,
  Program,
  ProgramService,
  ProgramWorkout,
  UpdateProgramWorkoutPayload,
  noWhitespaceValidator,
  showApiError,
} from 'core';

/**
 * Create / edit a workout (a single "day") within a program.
 *
 * `weekIndex` is 0-based; the BE caps it at `ceil(program.durationDays / 7) - 1`
 * when set, otherwise at 104. `dayIndex` is 0..6 (Mon..Sun, matching
 * BE convention which differs from the ISO 1..7 used for recurrence).
 *
 * (weekIndex, dayIndex) must be unique within the program — the
 * service catches that and surfaces a clear error message.
 */
@Component({
  selector: 'mh-workout-form-dialog',
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
  templateUrl: './workout-form-dialog.html',
  styleUrl: './workout-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutFormDialog {
  readonly program = input.required<Program>();
  /** When set → edit mode. When null → create mode. */
  readonly workout = input<ProgramWorkout | null>(null);
  /** When provided in create mode, pre-fills weekIndex. */
  readonly initialWeek = input<number | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<ProgramWorkout>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);

  private readonly _nameInput =
    viewChild<ElementRef<HTMLInputElement>>('nameInput');

  readonly submitting = signal(false);

  // ── Form ─────────────────────────────────────────────────────────

  readonly form = this._formBuilder.nonNullable.group({
    name: ['', noWhitespaceValidator],
    notes: [''],
    weekIndex: [0],
    dayIndex: [0],
    phase: [''],
    estimatedDurationMinutes: [null as number | null],
  });

  // ── Options ──────────────────────────────────────────────────────

  readonly dayOptions: SelectItem<number>[] = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ];

  readonly weekOptions = computed<SelectItem<number>[]>(() => {
    const days = this.program().durationDays ?? 84; // 12 weeks default
    const dur = Math.max(1, Math.ceil(days / 7));
    return Array.from({ length: dur }, (_, i) => ({
      value: i,
      label: `Week ${i + 1}`,
    }));
  });

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEdit = computed(() => this.workout() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit workout' : 'New workout',
  );
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Add workout',
  );

  // ── Validation ───────────────────────────────────────────────────
  // A disabled submit button fails silently — instead the button stays
  // clickable and an invalid submit surfaces the inline error + focus.

  isFieldInvalid(field: 'name'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  getFieldError(field: 'name'): string {
    const errors = this.form.controls[field].errors;
    if (errors?.['required']) return 'Workout name is required.';
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

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this._nameInput()?.nativeElement.focus();
      return;
    }

    const value = this.form.getRawValue();
    const payload: CreateProgramWorkoutPayload = {
      name: value.name.trim(),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      weekIndex: value.weekIndex,
      dayIndex: value.dayIndex,
      ...(value.phase.trim() ? { phase: value.phase.trim() } : {}),
      ...(value.estimatedDurationMinutes != null
        ? { estimatedDurationMinutes: value.estimatedDurationMinutes }
        : {}),
    };

    this.submitting.set(true);
    const existing = this.workout();
    const req$ = existing
      ? this._programService.updateWorkout(
          this.program().id,
          existing.id,
          payload as UpdateProgramWorkoutPayload,
        )
      : this._programService.addWorkout(this.program().id, payload);

    req$.subscribe({
      next: (w) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Workout updated' : 'Workout added',
          detail: w.name,
          life: 2500,
        });
        this.saved.emit(w);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          existing ? "Couldn't save workout" : "Couldn't add workout",
          'Please check the form and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(): void {
    const w = this.workout();
    if (w) {
      this.form.reset({
        name: w.name,
        notes: w.notes ?? '',
        weekIndex: w.weekIndex,
        dayIndex: w.dayIndex,
        phase: w.phase ?? '',
        estimatedDurationMinutes: w.estimatedDurationMinutes,
      });
    } else {
      this.form.reset({ weekIndex: this.initialWeek() ?? 0 });
    }
  }
}
