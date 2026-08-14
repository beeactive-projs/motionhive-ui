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
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { from } from 'rxjs';
import { concatMap, map, tap } from 'rxjs/operators';

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
 * Pick exercises from the catalog and attach them to a workout slot.
 *
 * Multi-select: search the catalog (SYSTEM + caller's PRIVATE + PUBLIC
 * custom — the BE filters per visibility), tick any number of rows —
 * the selection persists across searches — then "Add N exercises"
 * POSTs one `prescribed_exercise` row per pick, sequentially, so the
 * BE's `orderIndex = max + 1` assignment can't race. Sets are added
 * via a separate dialog (FE-P2e).
 *
 * The catalog list is scoped to a 300ms debounced search and the first
 * 50 results — enough to bridge to the full catalog page if we ever
 * need more advanced filtering.
 */
@Component({
  selector: 'mh-exercise-picker-dialog',
  imports: [
    LowerCasePipe,
    FormsModule,
    ButtonDirective,
    Dialog,
    IconField,
    InputIcon,
    InputText,
    Skeleton,
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
  /** All exercises created by one confirm (order preserved). */
  readonly added = output<PrescribedExercise[]>();
  /**
   * Emit-only mode: the dialog doesn't call the programs BE; it just
   * fires `picked` with the chosen Exercise so the parent can decide
   * what to do with it (e.g. attach to a live workout-log instead of a
   * program). Emit-only consumers (workout log append/swap, routine
   * builder) expect exactly ONE exercise per confirm, so this mode
   * stays single-select; the dialog closes after picking and no
   * network call happens.
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
  /**
   * Selection keyed by exercise id, valued with the full Exercise so
   * the pick survives result-set changes while searching (the row may
   * no longer be in `results` when the user confirms).
   */
  readonly selectedById = signal<Map<string, Exercise>>(new Map());
  readonly submitting = signal(false);

  /** Multi-select everywhere except emit-only mode (see `emitOnly`). */
  readonly multi = computed(() => !this.emitOnly());
  readonly selectedCount = computed(() => this.selectedById().size);

  readonly canSubmit = computed(
    () => this.selectedCount() > 0 && !this.submitting(),
  );

  readonly submitLabel = computed(() => {
    if (this.emitOnly()) return 'Add to workout';
    const n = this.selectedCount();
    if (n <= 1) return 'Add exercise';
    return `Add ${n} exercises`;
  });

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
        this.selectedById.set(new Map());
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

  isSelected(exerciseId: string): boolean {
    return this.selectedById().has(exerciseId);
  }

  toggle(exercise: Exercise): void {
    this.selectedById.update((cur) => {
      const next = new Map(cur);
      if (this.multi()) {
        if (next.has(exercise.id)) next.delete(exercise.id);
        else next.set(exercise.id, exercise);
        return next;
      }
      // Single-select (emit-only mode): clicking a row switches the pick.
      return new Map([[exercise.id, exercise]]);
    });
  }

  clearSelection(): void {
    this.selectedById.set(new Map());
  }

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  submit(): void {
    const picks = Array.from(this.selectedById().values());
    if (picks.length === 0 || this.submitting()) return;

    // Emit-only mode: hand the chosen exercise back to the parent and
    // close. The parent owns the BE call (the active log calls the
    // workout-log endpoint, not the programs endpoint).
    if (this.emitOnly()) {
      this.picked.emit(picks[0]);
      this.visible.set(false);
      return;
    }

    this.submitting.set(true);
    const saved: PrescribedExercise[] = [];
    // Sequential POSTs (no bulk endpoint on the BE) — concatMap keeps
    // creation order deterministic so orderIndex follows pick order.
    from(picks)
      .pipe(
        concatMap((ex) => {
          const payload: CreatePrescribedExercisePayload = {
            exerciseId: ex.id,
          };
          return this._programService
            .addExercise(this.program().id, this.workout().id, payload)
            .pipe(
              // Backfill the eager-loaded `exercise` relation — the POST
              // response doesn't include it, but we have the full Exercise
              // object from the picker selection. Without this the program
              // detail renders the row title as "—".
              map((row) => ({ ...row, exercise: ex })),
              tap((row) => saved.push(row)),
            );
        }),
      )
      .subscribe({
        complete: () => {
          this.submitting.set(false);
          this._messageService.add({
            severity: 'success',
            summary: saved.length === 1 ? 'Exercise added' : 'Exercises added',
            detail:
              saved.length === 1
                ? `${picks[0].name} added to ${this.workout().name}.`
                : `${saved.length} exercises added to ${this.workout().name}.`,
            life: 2500,
          });
          this.added.emit([...saved]);
          this.visible.set(false);
        },
        error: (err) => {
          this.submitting.set(false);
          // Surface what did land, drop it from the selection, and keep
          // the dialog open so the user can retry just the remainder.
          if (saved.length > 0) {
            this.added.emit([...saved]);
            this.selectedById.update((cur) => {
              const next = new Map(cur);
              for (const row of saved) next.delete(row.exerciseId);
              return next;
            });
          }
          showApiError(
            this._messageService,
            "Couldn't add all exercises",
            saved.length > 0
              ? `${saved.length} added before the error — the rest are still selected.`
              : 'Please try again.',
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
