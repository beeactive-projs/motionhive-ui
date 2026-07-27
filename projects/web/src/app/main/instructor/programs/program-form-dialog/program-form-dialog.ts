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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

import {
  CreateProgramPayload,
  Program,
  ProgramKind,
  ProgramService,
  ProgramStatus,
  UpdateProgramPayload,
  noWhitespaceValidator,
  showApiError,
  trimmedMinLength,
} from 'core';

type DurationUnit = 'weeks' | 'days';

const parseTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

/** BE caps goalTags at 10 (`ArrayMaxSize`). */
const maxTagsValidator =
  (max: number): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const n = parseTags((control.value as string | null) ?? '').length;
    return n > max ? { maxTags: { max, actual: n } } : null;
  };

/**
 * Create / edit a program shell (FE-P2a + FE-P2b).
 *
 * Single component covers both flows. When `program` is null → create
 * (POST /programs). When non-null → edit (PATCH /programs/:id).
 *
 * V1 only ships `kind = WORKOUT`; the BE accepts the others for forward
 * compat (locked decision §3) so we expose the picker but pre-select
 * Workout and don't surface MEAL/HABIT until those modules exist.
 *
 * Workouts/exercises/sets are added via the nested-CRUD endpoints once
 * the program shell exists — this dialog only owns the metadata.
 */
@Component({
  selector: 'mh-program-form-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    InputText,
    Message,
    Select,
    SelectButton,
    Textarea,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './program-form-dialog.html',
  styleUrl: './program-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramFormDialog {
  /** When set → edit mode. When null → create mode. */
  readonly program = input<Program | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<Program>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);

  private readonly _nameInput =
    viewChild<ElementRef<HTMLInputElement>>('nameInput');

  readonly submitting = signal(false);

  // ── Form ─────────────────────────────────────────────────────────
  // Duration is stored on the BE in days; the form lets the author pick
  // the INPUT unit (weeks default, days for short / "21-day" shapes).

  readonly form = this._formBuilder.nonNullable.group({
    name: ['', [noWhitespaceValidator, trimmedMinLength(2)]],
    description: [''],
    kind: [ProgramKind.Workout as ProgramKind],
    status: [ProgramStatus.Draft as ProgramStatus],
    durationUnit: ['weeks' as DurationUnit],
    durationValue: [null as number | null],
    periodizationModel: [''],
    goalTags: ['', maxTagsValidator(10)],
  });

  // ── Options ──────────────────────────────────────────────────────

  readonly kindOptions: SelectItem<ProgramKind>[] = [
    { value: ProgramKind.Workout, label: 'Workout' },
    // Meal/Habit/Hybrid are intentionally hidden until those modules ship.
  ];

  readonly statusOptions: SelectItem<ProgramStatus>[] = [
    { value: ProgramStatus.Draft, label: 'Draft — only you can see it' },
    { value: ProgramStatus.Published, label: 'Published — ready to assign' },
    { value: ProgramStatus.Archived, label: 'Archived — hidden, not deleted' },
  ];

  readonly periodizationOptions: SelectItem<string>[] = [
    { value: '', label: 'None' },
    { value: 'linear', label: 'Linear' },
    { value: 'undulating', label: 'Undulating' },
    { value: 'block', label: 'Block' },
    { value: 'conjugate', label: 'Conjugate' },
  ];

  readonly unitOptions: SelectItem<DurationUnit>[] = [
    { value: 'weeks', label: 'Weeks' },
    { value: 'days', label: 'Days' },
  ];

  /** Cap derived from the unit. BE accepts 1..728 days = 1..104 weeks. */
  durationMax(): number {
    return this.form.controls.durationUnit.value === 'weeks' ? 104 : 728;
  }

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEdit = computed(() => this.program() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit program' : 'New program',
  );
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Create program',
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
    if (errors?.['required']) return 'Name is required.';
    if (errors?.['minlength']) return 'Name must be at least 2 characters.';
    return '';
  }

  /**
   * Shown live (not gated on touched) — it can only trip after the 11th
   * comma-separated entry, which is deliberate input.
   */
  goalTagsError(): string | null {
    const errors = this.form.controls.goalTags.errors;
    return errors?.['maxTags']
      ? `Up to 10 tags allowed — you have ${errors['maxTags'].actual}.`
      : null;
  }

  constructor() {
    effect(() => {
      // Hydrate fields whenever the dialog opens or the bound program changes.
      if (this.visible()) {
        this._hydrate(this.program());
      }
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
      if (this.form.controls.name.invalid) {
        this._nameInput()?.nativeElement.focus();
      }
      return;
    }

    const value = this.form.getRawValue();
    const goalTags = parseTags(value.goalTags);
    const durationDays =
      value.durationValue == null
        ? undefined
        : value.durationUnit === 'weeks'
          ? value.durationValue * 7
          : value.durationValue;
    const payload: CreateProgramPayload = {
      name: value.name.trim(),
      ...(value.description.trim()
        ? { description: value.description.trim() }
        : {}),
      kind: value.kind,
      status: value.status,
      ...(durationDays != null ? { durationDays } : {}),
      ...(value.periodizationModel.trim()
        ? { periodizationModel: value.periodizationModel.trim() }
        : {}),
      ...(goalTags.length > 0 ? { goalTags } : {}),
    };

    this.submitting.set(true);
    const existing = this.program();
    const req$ = existing
      ? this._programService.update(existing.id, payload as UpdateProgramPayload)
      : this._programService.create(payload);

    req$.subscribe({
      next: (p) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Program updated' : 'Program created',
          detail: existing
            ? `${p.name} saved.`
            : `${p.name} is ready — add workouts to it next.`,
          life: 3500,
        });
        this.saved.emit(p);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          existing ? "Couldn't save program" : "Couldn't create program",
          'Please check the form and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(p: Program | null): void {
    if (!p) {
      this.form.reset();
      return;
    }
    // Hydrate the input unit by preferring weeks when the value divides
    // evenly (the common case authored as N weeks). Day-counted programs
    // (e.g. 21 days) snap to days automatically.
    let durationUnit: DurationUnit = 'weeks';
    let durationValue: number | null = null;
    if (p.durationDays != null) {
      if (p.durationDays % 7 === 0) {
        durationValue = p.durationDays / 7;
      } else {
        durationUnit = 'days';
        durationValue = p.durationDays;
      }
    }
    this.form.reset({
      name: p.name,
      description: p.description ?? '',
      kind: p.kind,
      status: p.status,
      durationUnit,
      durationValue,
      periodizationModel: p.periodizationModel ?? '',
      goalTags: (p.goalTags ?? []).join(', '),
    });
  }
}
