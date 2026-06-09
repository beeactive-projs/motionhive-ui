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
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

import {
  CreateProgramWorkoutPayload,
  Program,
  ProgramService,
  ProgramWorkout,
  UpdateProgramWorkoutPayload,
  showApiError,
} from 'core';

interface SelectOption<T> {
  value: T;
  label: string;
}

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
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    Dialog,
    InputNumber,
    InputTextModule,
    Select,
    TextareaModule,
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

  readonly submitting = signal(false);

  // ── Form fields ──────────────────────────────────────────────────

  readonly name = signal('');
  readonly notes = signal('');
  readonly weekIndex = signal<number>(0);
  readonly dayIndex = signal<number>(0);
  readonly phase = signal<string>('');
  readonly estimatedDurationMinutes = signal<number | null>(null);

  // ── Options ──────────────────────────────────────────────────────

  readonly dayOptions: SelectOption<number>[] = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ];

  readonly weekOptions = computed<SelectOption<number>[]>(() => {
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

  submit(): void {
    if (!this.canSubmit()) return;
    const payload: CreateProgramWorkoutPayload = {
      name: this.name().trim(),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      weekIndex: this.weekIndex(),
      dayIndex: this.dayIndex(),
      ...(this.phase().trim() ? { phase: this.phase().trim() } : {}),
      ...(this.estimatedDurationMinutes() != null
        ? {
            estimatedDurationMinutes: this
              .estimatedDurationMinutes() as number,
          }
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
      this.name.set(w.name);
      this.notes.set(w.notes ?? '');
      this.weekIndex.set(w.weekIndex);
      this.dayIndex.set(w.dayIndex);
      this.phase.set(w.phase ?? '');
      this.estimatedDurationMinutes.set(w.estimatedDurationMinutes);
    } else {
      this.name.set('');
      this.notes.set('');
      this.weekIndex.set(this.initialWeek() ?? 0);
      this.dayIndex.set(0);
      this.phase.set('');
      this.estimatedDurationMinutes.set(null);
    }
  }
}
