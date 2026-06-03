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
  CreateProgramPayload,
  Program,
  ProgramKind,
  ProgramService,
  ProgramStatus,
  UpdateProgramPayload,
  showApiError,
} from 'core';

interface SelectOption<T> {
  value: T;
  label: string;
}

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

  readonly submitting = signal(false);

  // ── Form fields ──────────────────────────────────────────────────

  readonly name = signal('');
  readonly description = signal('');
  readonly kind = signal<ProgramKind>(ProgramKind.Workout);
  readonly status = signal<ProgramStatus>(ProgramStatus.Draft);
  readonly durationWeeks = signal<number | null>(null);
  readonly periodizationModel = signal<string>('');
  readonly goalTagsRaw = signal<string>('');

  // ── Options ──────────────────────────────────────────────────────

  readonly kindOptions: SelectOption<ProgramKind>[] = [
    { value: ProgramKind.Workout, label: 'Workout' },
    // Meal/Habit/Hybrid are intentionally hidden until those modules ship.
  ];

  readonly statusOptions: SelectOption<ProgramStatus>[] = [
    { value: ProgramStatus.Draft, label: 'Draft — only you can see it' },
    { value: ProgramStatus.Published, label: 'Published — ready to assign' },
    { value: ProgramStatus.Archived, label: 'Archived — hidden, not deleted' },
  ];

  readonly periodizationOptions: SelectOption<string>[] = [
    { value: '', label: 'None' },
    { value: 'linear', label: 'Linear' },
    { value: 'undulating', label: 'Undulating' },
    { value: 'block', label: 'Block' },
    { value: 'conjugate', label: 'Conjugate' },
  ];

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEdit = computed(() => this.program() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit program' : 'New program',
  );
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Create program',
  );
  readonly canSubmit = computed(
    () => this.name().trim().length >= 2 && !this.submitting(),
  );

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
    if (!this.canSubmit()) return;

    const goalTags = this._parseTags(this.goalTagsRaw());
    const payload: CreateProgramPayload = {
      name: this.name().trim(),
      ...(this.description().trim()
        ? { description: this.description().trim() }
        : {}),
      kind: this.kind(),
      status: this.status(),
      ...(this.durationWeeks() != null
        ? { durationWeeks: this.durationWeeks() as number }
        : {}),
      ...(this.periodizationModel().trim()
        ? { periodizationModel: this.periodizationModel().trim() }
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
    if (p) {
      this.name.set(p.name);
      this.description.set(p.description ?? '');
      this.kind.set(p.kind);
      this.status.set(p.status);
      this.durationWeeks.set(p.durationWeeks);
      this.periodizationModel.set(p.periodizationModel ?? '');
      this.goalTagsRaw.set((p.goalTags ?? []).join(', '));
    } else {
      this.name.set('');
      this.description.set('');
      this.kind.set(ProgramKind.Workout);
      this.status.set(ProgramStatus.Draft);
      this.durationWeeks.set(null);
      this.periodizationModel.set('');
      this.goalTagsRaw.set('');
    }
  }

  private _parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, 10);
  }
}
