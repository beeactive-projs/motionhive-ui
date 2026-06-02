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
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import {
  AuthStore,
  Exercise,
  ExerciseService,
  ExerciseSource,
  ExerciseVisibility,
  MuscleRole,
  showApiError,
} from 'core';

/**
 * Exercise Detail Dialog (S2 — minimal V1).
 *
 * Opens when the catalog card emits `select`. Lazy-fetches the full
 * row on first open of a given id (so the list can stay lightweight).
 *
 * Owner actions (Edit / Visibility flip / Delete) and Fork all live
 * in the action bar at the bottom. Visibility scopes:
 *   - System exercises  → no actions (read-only via this surface)
 *   - Mine              → Edit + Visibility toggle + Delete
 *   - Public by another → Fork
 *
 * Owns its own `<p-dialog>` per the dialog idiom — parent passes
 * `visible` (two-way) + `exerciseId` and listens for mutation outputs.
 */
@Component({
  selector: 'mh-exercise-detail-dialog',
  standalone: true,
  imports: [
    ButtonModule,
    ConfirmDialog,
    Dialog,
    TooltipModule,
    TitleCasePipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './exercise-detail-dialog.html',
  styleUrl: './exercise-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseDetailDialog {
  readonly visible = model(false);
  readonly exerciseId = input<string | null>(null);

  readonly editRequested = output<Exercise>();
  readonly deleted = output<void>();
  readonly visibilityChanged = output<Exercise>();
  readonly forked = output<string>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);

  readonly exercise = signal<Exercise | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  private _loadedId: string | null = null;

  // ── Role-based action visibility ─────────────────────────────────

  readonly isMine = computed(() => {
    const ex = this.exercise();
    const me = this._authStore.user();
    return !!ex && !!me && ex.ownerId === me.id;
  });

  readonly canFork = computed(() => {
    const ex = this.exercise();
    return (
      !!ex &&
      ex.source !== ExerciseSource.System &&
      ex.visibility === ExerciseVisibility.Public &&
      !this.isMine()
    );
  });

  readonly canEdit = this.isMine;
  readonly canDelete = this.isMine;
  readonly canToggleVisibility = this.isMine;

  // ── Muscle / equipment projections (unchanged from V1) ───────────

  readonly primaryMuscles = computed(() =>
    (this.exercise()?.muscleRoles ?? [])
      .filter((m) => m.role === MuscleRole.Primary)
      .map((m) => m.muscle?.commonName ?? '—'),
  );

  readonly secondaryMuscles = computed(() =>
    (this.exercise()?.muscleRoles ?? [])
      .filter((m) => m.role === MuscleRole.Secondary)
      .map((m) => m.muscle?.commonName ?? '—'),
  );

  readonly stabilizerMuscles = computed(() =>
    (this.exercise()?.muscleRoles ?? [])
      .filter((m) => m.role === MuscleRole.Stabilizer)
      .map((m) => m.muscle?.commonName ?? '—'),
  );

  readonly equipmentList = computed(() =>
    (this.exercise()?.equipment ?? []).map((e) => e.name),
  );

  constructor() {
    // Lazy-load on (visible && id-change). Skip when re-opening the
    // same id — preserves scroll position.
    effect(() => {
      if (!this.visible()) return;
      const id = this.exerciseId();
      if (!id || id === this._loadedId) return;
      this.fetch(id);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  requestEdit(): void {
    const ex = this.exercise();
    if (ex) this.editRequested.emit(ex);
  }

  toggleVisibility(): void {
    const ex = this.exercise();
    if (!ex || this.busy()) return;
    const next =
      ex.visibility === ExerciseVisibility.Public
        ? ExerciseVisibility.Private
        : ExerciseVisibility.Public;

    this.busy.set(true);
    this._exerciseService.update(ex.id, { visibility: next }).subscribe({
      next: (updated) => {
        this.exercise.set(updated);
        this._messageService.add({
          severity: 'success',
          summary: next === 'PUBLIC' ? 'Now public' : 'Now private',
          detail:
            next === 'PUBLIC'
              ? 'Other instructors can view and fork it.'
              : 'Only you can see it. Existing program references stay intact.',
          life: 4000,
        });
        this.visibilityChanged.emit(updated);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          'Visibility change failed',
          'Could not update the exercise. Try again in a moment.',
          err,
        ),
      complete: () => this.busy.set(false),
    });
  }

  confirmDelete(): void {
    const ex = this.exercise();
    if (!ex) return;
    const forkCopy =
      ex.forkCount > 0
        ? ` It's been forked by ${ex.forkCount} ${ex.forkCount === 1 ? 'instructor' : 'instructors'} — their copies are independent and stay intact.`
        : '';
    this._confirmationService.confirm({
      header: `Delete "${ex.name}"?`,
      message: `This can't be undone.${forkCopy}`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete exercise',
      acceptIcon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => this.runDelete(ex.id),
    });
  }

  fork(): void {
    const ex = this.exercise();
    if (!ex || this.busy()) return;
    this.busy.set(true);
    this._exerciseService.fork(ex.id).subscribe({
      next: (forkEx) => {
        this._messageService.add({
          severity: 'success',
          summary: 'Forked to your library',
          detail: `"${forkEx.name}" is now private — edit anytime.`,
          life: 4000,
        });
        // Close the detail and let the parent open the new fork.
        this.visible.set(false);
        this.forked.emit(forkEx.id);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          'Fork failed',
          'You may already have a fork of this exercise.',
          err,
        ),
      complete: () => this.busy.set(false),
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this.exercise.set(null);
    this._exerciseService.get(id).subscribe({
      next: (ex) => {
        this.exercise.set(ex);
        this._loadedId = id;
      },
      error: (err) => {
        this.visible.set(false);
        showApiError(
          this._messageService,
          "Couldn't load exercise",
          'It may have been removed or set to private.',
          err,
        );
      },
      complete: () => this.loading.set(false),
    });
  }

  private runDelete(id: string): void {
    this.busy.set(true);
    this._exerciseService.remove(id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Exercise deleted',
          life: 3000,
        });
        this.visible.set(false);
        this.deleted.emit();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          'Delete failed',
          'Could not delete the exercise. Try again in a moment.',
          err,
        ),
      complete: () => this.busy.set(false),
    });
  }
}
