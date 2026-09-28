import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

import {
  AuthStore,
  EXERCISE_EQUIPMENT_TAG_CLASS,
  EXERCISE_META_TAG_CLASS,
  EnumLabelPipe,
  Exercise,
  ExerciseMedia,
  ExerciseMediaKind,
  ExerciseService,
  ExerciseSource,
  ExerciseVisibility,
  exerciseLevelTag,
  exerciseMuscleTagClass,
  MuscleRole,
  escapeHtml,
  showApiError,
  YoutubeEmbed,
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
  imports: [
    ButtonDirective,
    ConfirmDialog,
    Dialog,
    Tag,
    TooltipModule,
    EnumLabelPipe,
    TranslatePipe,
    YoutubeEmbed,
  ],
  providers: [ConfirmationService],
  templateUrl: './exercise-detail-dialog.html',
  styleUrl: './exercise-detail-dialog.scss',
})
export class ExerciseDetailDialog {
  readonly visible = model(false);
  readonly exerciseId = input<string | null>(null);
  /**
   * When true, hides every mutation affordance (Edit, Delete, Visibility
   * flip, Fork) regardless of the caller's ownership. Set from every
   * consumer surface that shows an exercise inside a routine or workout
   * context — a client viewing a coach's exercise from a routine should
   * never see an Edit button, even if some role check would otherwise
   * grant one.
   */
  readonly readOnly = input<boolean>(false);

  readonly editRequested = output<Exercise>();
  readonly deleted = output<void>();
  readonly visibilityChanged = output<Exercise>();
  readonly forked = output<string>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);

  readonly Sources = ExerciseSource;
  readonly Visibilities = ExerciseVisibility;
  readonly MuscleRoles = MuscleRole;

  // Shared exercise tag palette (single source of truth in core).
  readonly levelTag = exerciseLevelTag;
  readonly muscleClass = exerciseMuscleTagClass;
  readonly equipmentClass = EXERCISE_EQUIPMENT_TAG_CLASS;
  readonly metaClass = EXERCISE_META_TAG_CLASS;

  readonly exercise = signal<Exercise | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  private _loadedId: string | null = null;

  /**
   * Image frames for the motion-cycle hero. Free Exercise DB seeds
   * two frames per exercise (start + end position) — alternating them
   * gives the same "in motion" hint a GIF would, with zero filesize
   * cost (just two JPGs already on jsDelivr).
   *
   * Sorted by `displayOrder` so the start frame is always first; the
   * cycle index advances every 1.4s.
   */
  readonly imageFrames = computed<ExerciseMedia[]>(() => {
    const media = this.exercise()?.media ?? [];
    return media
      .filter((m) => m.kind === ExerciseMediaKind.Image)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  });

  readonly cycleIndex = signal(0);
  private _cycleTimer: ReturnType<typeof setInterval> | null = null;

  // ── Role-based action visibility ─────────────────────────────────

  readonly isMine = computed(() => {
    const ex = this.exercise();
    const me = this._authStore.user();
    return !!ex && !!me && ex.ownerId === me.id;
  });

  readonly canFork = computed(() => {
    const ex = this.exercise();
    if (this.readOnly()) return false;
    return (
      // Forking writes a copy into a personal library — instructor-only
      // on the BE. Clients browse read-only, so don't offer them Fork.
      this._authStore.isInstructor() &&
      !!ex &&
      ex.source !== ExerciseSource.System &&
      ex.visibility === ExerciseVisibility.Public &&
      !this.isMine()
    );
  });

  // readOnly hard-gates every mutation regardless of ownership.
  readonly canEdit = computed(() => !this.readOnly() && this.isMine());
  readonly canDelete = computed(() => !this.readOnly() && this.isMine());
  readonly canToggleVisibility = computed(() => !this.readOnly() && this.isMine());

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

  readonly equipmentList = computed(() => (this.exercise()?.equipment ?? []).map((e) => e.name));

  constructor() {
    // Lazy-load on (visible && id-change). Skip when re-opening the
    // same id — preserves scroll position.
    effect(() => {
      if (!this.visible()) return;
      const id = this.exerciseId();
      if (!id || id === this._loadedId) return;
      this.fetch(id);
    });

    // Drive the image cycle. Pure effect — re-evaluates whenever the
    // dialog opens/closes or the frame list changes. Cleans up on
    // close so the interval doesn't leak across instances.
    effect((onCleanup) => {
      const open = this.visible();
      const frames = this.imageFrames();
      if (!open || frames.length < 2) {
        if (this._cycleTimer) clearInterval(this._cycleTimer);
        this._cycleTimer = null;
        this.cycleIndex.set(0);
        return;
      }
      this.cycleIndex.set(0);
      this._cycleTimer = setInterval(() => {
        this.cycleIndex.update((i) => (i + 1) % frames.length);
      }, 1400);
      onCleanup(() => {
        if (this._cycleTimer) clearInterval(this._cycleTimer);
        this._cycleTimer = null;
      });
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
        const toastKey =
          next === ExerciseVisibility.Public
            ? 'exercises.toast.madePublic'
            : 'exercises.toast.madePrivate';
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant(`${toastKey}.summary`),
          detail: this._translateService.instant(`${toastKey}.detail`),
          life: 4000,
        });
        this.visibilityChanged.emit(updated);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('exercises.toast.visibilityFailed.summary'),
          this._translateService.instant('exercises.toast.visibilityFailed.detail'),
          err,
        ),
      complete: () => this.busy.set(false),
    });
  }

  confirmDelete(): void {
    const ex = this.exercise();
    if (!ex) return;
    const t = (key: string, params?: Record<string, unknown>): string =>
      this._translateService.instant(key, params);
    const forkCopy =
      ex.forkCount > 0
        ? ` ${t('exercises.confirm.delete.forked', { count: ex.forkCount })}`
        : '';
    this._confirmationService.confirm({
      header: t('exercises.confirm.delete.header', { name: ex.name }),
      message:
        `${t('exercises.confirm.delete.message', { name: escapeHtml(ex.name) })}<br />` +
        ` ${t('exercises.confirm.delete.irreversible')}${forkCopy}`,
      acceptButtonProps: {
        severity: 'danger',
        label: t('exercises.confirm.delete.accept'),
        icon: 'pi pi-trash',
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: t('button.no'),
        icon: 'pi pi-times',
        outlined: true,
      },
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
          summary: this._translateService.instant('exercises.toast.forked.summary'),
          detail: this._translateService.instant('exercises.toast.forked.detail', {
            name: forkEx.name,
          }),
          life: 4000,
        });
        // Close the detail and let the parent open the new fork.
        this.visible.set(false);
        this.forked.emit(forkEx.id);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('exercises.toast.forkFailed.summary'),
          this._translateService.instant('exercises.toast.forkFailed.detail'),
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
          this._translateService.instant('exercises.toast.loadOneFailed.summary'),
          this._translateService.instant('exercises.toast.loadOneFailed.detail'),
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
          summary: this._translateService.instant('exercises.toast.deleted'),
          life: 3000,
        });
        this.visible.set(false);
        this.deleted.emit();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('exercises.toast.deleteFailed.summary'),
          this._translateService.instant('exercises.toast.deleteFailed.detail'),
          err,
        ),
      complete: () => this.busy.set(false),
    });
  }
}
