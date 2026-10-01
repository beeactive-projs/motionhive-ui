import {
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { catchError, of, switchMap } from 'rxjs';

import {
  CreateProgramPayload,
  Program,
  ProgramKind,
  ProgramService,
  ProgramStatus,
  UpdateProgramPayload,
  enumLabel,
  noWhitespaceValidator,
  showApiError,
  trimmedMinLength,
  validationMessage,
} from 'core';

import { PERIODIZATION_MODELS } from '../program-labels';

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
    ButtonDirective,
    Checkbox,
    Dialog,
    InputNumber,
    InputText,
    Message,
    Select,
    SelectButton,
    Textarea,
    Toast,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './program-form-dialog.html',
  styleUrl: './program-form-dialog.scss',
})
export class ProgramFormDialog {
  /** When set → edit mode. When null → create mode. */
  readonly program = input<Program | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<Program>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _translateService = inject(TranslateService);

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
    /** Fill the empty weeks a longer program gains. Not part of the payload. */
    repeatWeeks: [false],
  });

  // ── Options ──────────────────────────────────────────────────────

  readonly kindOptions: SelectItem<ProgramKind>[] = [
    { value: ProgramKind.Workout, label: enumLabel('programKind', ProgramKind.Workout) },
    // Meal/Habit/Hybrid are intentionally hidden until those modules ship.
  ];

  readonly statusOptions: SelectItem<ProgramStatus>[] = [
    ProgramStatus.Draft,
    ProgramStatus.Published,
    ProgramStatus.Archived,
  ].map((value) => ({
    value,
    label: this._translateService.instant(`programs.programForm.statusOption.${value}`),
  }));

  readonly periodizationOptions: SelectItem<string>[] = [
    { value: '', label: this._translateService.instant('common.none') },
    ...PERIODIZATION_MODELS.map((value) => ({
      value,
      label: this._translateService.instant(`programs.periodization.${value}`),
    })),
  ];

  readonly unitOptions: SelectItem<DurationUnit>[] = [
    { value: 'weeks', label: this._translateService.instant('programs.programForm.unit.weeks') },
    { value: 'days', label: this._translateService.instant('programs.programForm.unit.days') },
  ];

  /** Cap derived from the unit. BE accepts 1..728 days = 1..104 weeks. */
  durationMax(): number {
    return this.form.controls.durationUnit.value === 'weeks' ? 104 : 728;
  }

  /**
   * The length currently typed, in whole weeks. Tracks the form rather than
   * reading it on submit so the warning below appears while the coach is
   * still deciding.
   */
  private readonly _formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly _typedWeeks = computed(() => {
    const v = this._formValue();
    if (v?.durationValue == null) return null;
    const days = v.durationUnit === 'weeks' ? v.durationValue * 7 : v.durationValue;
    return Math.ceil(days / 7);
  });

  /**
   * Days that would be deleted by the length now typed.
   *
   * Shortening a program is a real edit: the weeks that no longer fit are
   * dropped, because a declared length the workouts contradict is what gave
   * clients an end date before their own last session.
   */
  readonly doomedDays = computed(() => {
    const weeks = this._typedWeeks();
    const workouts = this.program()?.workouts;
    if (weeks == null || !workouts?.length) return 0;
    return workouts.filter((w) => w.weekIndex >= weeks).length;
  });

  /** The length in weeks when the dialog opened, to tell lengthening apart. */
  private readonly _openedWeeks = signal(0);

  /** Weeks 1…n that hold the work so far — the block a longer program repeats. */
  readonly builtWeeks = computed(() =>
    (this.program()?.workouts ?? []).reduce((max, w) => Math.max(max, w.weekIndex + 1), 0),
  );

  /** Empty weeks after the built ones, at the length now typed. */
  readonly emptyWeeks = computed(() => {
    const weeks = this._typedWeeks();
    const built = this.builtWeeks();
    return weeks == null || built === 0 ? 0 : Math.max(0, weeks - built);
  });

  private readonly _lengthening = computed(() => (this._typedWeeks() ?? 0) > this._openedWeeks());

  readonly repeatLabel = computed(() =>
    this._translateService.instant('programs.programForm.repeatWeeks', {
      built: this.builtWeeks(),
      empty: this.emptyWeeks(),
    }),
  );

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEdit = computed(() => this.program() !== null);
  readonly dialogHeader = computed(() =>
    this._translateService.instant(
      this.isEdit() ? 'programs.programForm.titleEdit' : 'programs.programForm.titleNew',
    ),
  );
  readonly submitLabel = computed(() =>
    this._translateService.instant(this.isEdit() ? 'button.saveChanges' : 'programs.list.create'),
  );

  // ── Validation ───────────────────────────────────────────────────
  // A disabled submit button fails silently — instead the button stays
  // clickable and an invalid submit surfaces the inline error + focus.

  isFieldInvalid(field: 'name'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  getFieldError(field: 'name'): string {
    return validationMessage(this.form.controls[field].errors, {
      required: 'programs.programForm.nameRequired',
      minlength: 'programs.programForm.nameMinLength',
    });
  }

  /**
   * Shown live (not gated on touched) — it can only trip after the 11th
   * comma-separated entry, which is deliberate input.
   */
  goalTagsError(): string | null {
    const errors = this.form.controls.goalTags.errors;
    return errors?.['maxTags']
      ? this._translateService.instant('programs.programForm.goalTagsError', {
          max: errors['maxTags'].max,
          count: errors['maxTags'].actual,
        })
      : null;
  }

  constructor() {
    effect(() => {
      // Hydrate fields whenever the dialog opens or the bound program changes.
      if (this.visible()) {
        this._hydrate(this.program());
      }
    });

    // Ticked by default while the program is being made longer — "ten weeks"
    // on a one-week plan means nine more of these — and left alone once the
    // coach has answered for themselves.
    effect(() => {
      const on = this._lengthening();
      const control = this.form.controls.repeatWeeks;
      if (control.pristine && control.value !== on) {
        control.setValue(on, { emitEvent: false });
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
    const repeat = !!existing && this.emptyWeeks() > 0 && value.repeatWeeks;
    const req$ = existing
      ? this._programService.update(existing.id, payload as UpdateProgramPayload).pipe(
          // The length is saved either way; a failed repeat leaves empty
          // weeks and says so, rather than failing the whole edit.
          switchMap((saved) =>
            repeat
              ? this._programService.repeatWeeks(existing.id).pipe(
                  catchError((err: unknown) => {
                    showApiError(
                      this._messageService,
                      this._translateService.instant('programs.toast.repeatWeeksError'),
                      this._translateService.instant('common.pleaseTryAgain'),
                      err,
                    );
                    return of(saved);
                  }),
                )
              : of(saved),
          ),
        )
      : this._programService.create(payload);

    req$.subscribe({
      next: (p) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant(
            existing ? 'programs.toast.programUpdated.summary' : 'programs.toast.programCreated.summary',
          ),
          detail: this._translateService.instant(
            existing ? 'programs.toast.programUpdated.detail' : 'programs.toast.programCreated.detail',
            { name: p.name },
          ),
          life: 3500,
        });
        this.saved.emit(p);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant(
            existing ? 'programs.toast.saveProgramError' : 'programs.toast.createProgramError',
          ),
          this._translateService.instant('programs.toast.checkForm'),
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(p: Program | null): void {
    if (!p) {
      this._openedWeeks.set(0);
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
    // An open-ended program has no declared length; what is built stands in.
    this._openedWeeks.set(
      p.durationDays != null ? Math.ceil(p.durationDays / 7) : this.builtWeeks(),
    );
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
