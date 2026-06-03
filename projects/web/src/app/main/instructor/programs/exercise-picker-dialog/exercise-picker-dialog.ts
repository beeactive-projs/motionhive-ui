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
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  CreatePrescribedExercisePayload,
  Exercise,
  ExerciseService,
  PrescribedExercise,
  Program,
  ProgramService,
  ProgramWorkout,
  showApiError,
} from 'core';

/**
 * Pick an exercise from the catalog and attach it to a workout slot.
 *
 * Single-select V1: search the catalog (SYSTEM + caller's PRIVATE +
 * PUBLIC custom — the BE filters per visibility), click a card, hit
 * "Add to workout" → POST creates a `prescribed_exercise` row at the
 * end of the workout. Sets are added via a separate dialog (FE-P2e).
 *
 * The catalog list is scoped to a 300ms debounced search and the first
 * 50 results — enough to bridge to the full catalog page if we ever
 * need more advanced filtering.
 */
@Component({
  selector: 'mh-exercise-picker-dialog',
  standalone: true,
  imports: [
    LowerCasePipe,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './exercise-picker-dialog.html',
  styleUrl: './exercise-picker-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExercisePickerDialog {
  readonly program = input.required<Program>();
  readonly workout = input.required<ProgramWorkout>();
  readonly visible = model<boolean>(false);
  readonly added = output<PrescribedExercise>();
  /**
   * Emit-only mode: the dialog doesn't call the programs BE; it just
   * fires `picked` with the chosen Exercise so the parent can decide
   * what to do with it (e.g. attach to a live workout-log instead of a
   * program). When true, the footer button still says "Add to workout"
   * and the dialog closes after picking, but no network call happens.
   */
  readonly emitOnly = input<boolean>(false);
  readonly picked = output<Exercise>();

  private readonly _programService = inject(ProgramService);
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);

  readonly query = signal('');
  readonly debouncedQuery = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly results = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly selected = computed(() =>
    this.results().find((e) => e.id === this.selectedId()) ?? null,
  );

  readonly canSubmit = computed(
    () => this.selectedId() !== null && !this.submitting(),
  );

  constructor() {
    effect(() => {
      // (Re)load whenever the dialog opens or the search changes.
      if (!this.visible()) return;
      this.debouncedQuery();
      this._load();
    });
    effect(() => {
      // Reset state on close so the next open starts clean.
      if (!this.visible()) {
        this.query.set('');
        this.debouncedQuery.set('');
        this.selectedId.set(null);
      }
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  onSearchChange(value: string): void {
    this.query.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(
      () => this.debouncedQuery.set(value.trim()),
      300,
    );
  }

  select(exerciseId: string): void {
    this.selectedId.set(exerciseId);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  submit(): void {
    const id = this.selectedId();
    if (!id) return;
    const pickedEx = this.selected();
    // Emit-only mode: hand the chosen exercise back to the parent and
    // close. The parent owns the BE call (the active log calls the
    // workout-log endpoint, not the programs endpoint).
    if (this.emitOnly()) {
      if (pickedEx) this.picked.emit(pickedEx);
      this.visible.set(false);
      return;
    }
    const payload: CreatePrescribedExercisePayload = { exerciseId: id };

    this.submitting.set(true);
    const picked = this.selected();
    this._programService
      .addExercise(this.program().id, this.workout().id, payload)
      .subscribe({
        next: (saved) => {
          this.submitting.set(false);
          const name = picked?.name ?? 'Exercise';
          this._messageService.add({
            severity: 'success',
            summary: 'Exercise added',
            detail: `${name} added to ${this.workout().name}.`,
            life: 2500,
          });
          // Backfill the eager-loaded `exercise` relation — the POST
          // response doesn't include it, but we have the full Exercise
          // object from the picker selection. Without this the program
          // detail renders the row title as "—".
          this.added.emit({ ...saved, exercise: picked ?? saved.exercise });
          this.visible.set(false);
        },
        error: (err) => {
          this.submitting.set(false);
          showApiError(
            this._messageService,
            "Couldn't add exercise",
            'Please try again.',
            err,
          );
        },
      });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _load(): void {
    this.loading.set(true);
    this._exerciseService
      .list({
        page: 1,
        limit: 50,
        search: this.debouncedQuery() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.results.set(res.items ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          showApiError(
            this._messageService,
            "Couldn't load exercises",
            'Please refresh and try again.',
            err,
          );
        },
      });
  }
}
