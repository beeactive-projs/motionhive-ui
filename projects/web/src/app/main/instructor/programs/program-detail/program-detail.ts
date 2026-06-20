import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { Chip } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';

import {
  ActionItem,
  ActionList,
  BottomSheet,
  ExerciseSetType,
  PrescribedExercise,
  PrescribedSet,
  Program,
  ProgramService,
  ProgramStatus,
  ProgramWorkout,
  TagSeverity,
  injectIsMobile,
  injectIsTablet,
  showApiError,
} from 'core';

import { KpiCard } from '../../../../_shared/components/kpi-card/kpi-card';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { AssignProgramDialog } from '../assign-program-dialog/assign-program-dialog';
import { ExercisePickerDialog } from '../exercise-picker-dialog/exercise-picker-dialog';
import { ProgramFormDialog } from '../program-form-dialog/program-form-dialog';
import { SetFormDialog } from '../set-form-dialog/set-form-dialog';
import { WorkoutFormDialog } from '../workout-form-dialog/workout-form-dialog';

/**
 * Program detail (FE-P1, read surface).
 *
 * Full nested tree from `GET /programs/:id`. Owner-only on the BE,
 * so we don't gate roles here — the BE 404s cross-instructor probes.
 *
 * Edit + Assign-to-client + Delete ship in FE-P2/P3; their CTAs are
 * stubbed with toasts so the page reads as "live but read-only".
 */
@Component({
  selector: 'mh-program-detail',
  standalone: true,
  imports: [
    TitleCasePipe,
    ButtonModule,
    ConfirmDialog,
    Toast,
    TagModule,
    TableModule,
    Chip,
    TooltipModule,
    ActionList,
    BottomSheet,
    KpiCard,
    ListEmptyState,
    AssignProgramDialog,
    ExercisePickerDialog,
    ProgramFormDialog,
    SetFormDialog,
    WorkoutFormDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './program-detail.html',
  styleUrl: './program-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();

  // Enum const exposed for template comparisons — never compare against raw
  // string literals (see CLAUDE.md).
  protected readonly ProgramStatus = ProgramStatus;

  readonly program = signal<Program | null>(null);
  readonly loading = signal(false);
  /** Mobile overflow sheet (Edit / Assign / Delete). */
  readonly actionsOpen = signal(false);
  readonly assignDialogOpen = signal(false);
  readonly editDialogOpen = signal(false);
  readonly workoutDialogOpen = signal(false);
  /** Workout being edited; null → create mode. */
  readonly workoutDialogTarget = signal<ProgramWorkout | null>(null);
  /** Pre-filled weekIndex when adding a new workout from a specific week. */
  readonly workoutDialogInitialWeek = signal<number | null>(null);
  readonly exercisePickerOpen = signal(false);
  /** Workout the picker will add the exercise to. */
  readonly exercisePickerTarget = signal<ProgramWorkout | null>(null);
  readonly setDialogOpen = signal(false);
  readonly setDialogTarget = signal<{
    workout: ProgramWorkout;
    exercise: PrescribedExercise;
    set: PrescribedSet | null;
  } | null>(null);
  readonly deleting = signal(false);

  // Group workouts by week for rendering.
  readonly weeks = computed<{ week: number; workouts: ProgramWorkout[] }[]>(() => {
    const all = this.program()?.workouts ?? [];
    const map = new Map<number, ProgramWorkout[]>();
    for (const w of all) {
      const arr = map.get(w.weekIndex) ?? [];
      arr.push(w);
      map.set(w.weekIndex, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, workouts]) => ({
        week,
        workouts: workouts.sort((a, b) => a.dayIndex - b.dayIndex),
      }));
  });

  readonly totalWorkouts = computed(() => this.program()?.workouts?.length ?? 0);

  readonly totalExercises = computed(() => {
    let n = 0;
    for (const w of this.program()?.workouts ?? []) {
      n += w.exercises?.length ?? 0;
    }
    return n;
  });

  readonly totalSets = computed(() => {
    let n = 0;
    for (const w of this.program()?.workouts ?? []) {
      for (const e of w.exercises ?? []) {
        n += e.sets?.length ?? 0;
      }
    }
    return n;
  });

  /** Action-sheet rows for the mobile ⋮ menu — mirror the desktop header buttons. */
  readonly detailActions = computed<ActionItem[]>(() => [
    { id: 'edit', icon: 'pi pi-pencil', label: 'Edit program' },
    { id: 'assign', icon: 'pi pi-user-plus', label: 'Assign to client' },
    { id: 'delete', icon: 'pi pi-trash', label: 'Delete program…', danger: true },
  ]);

  ngOnInit(): void {
    // The codebase reads route params via ActivatedRoute snapshot
    // (input binding via `withComponentInputBinding()` is NOT wired
    // in app.config.ts). Single-shot read is enough — navigating to
    // a different program id always re-mounts the component because
    // there are no sibling routes that would reuse it.
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.fetch(id);
    else this._router.navigate(['/coaching/programs']);
  }

  // ── Stub actions (wired in FE-P2/P3) ─────────────────────────────

  openEdit(): void {
    if (!this.program()) return;
    this.editDialogOpen.set(true);
  }

  onEdited(p: Program): void {
    // Preserve nested workouts (the edit payload returns the shell only).
    const existing = this.program();
    this.program.set(existing ? { ...existing, ...p, workouts: existing.workouts } : p);
    this.editDialogOpen.set(false);
  }

  // ── Workout CRUD ─────────────────────────────────────────────────

  openAddWorkout(weekIndex: number | null = null): void {
    if (!this.program()) return;
    this.workoutDialogTarget.set(null);
    this.workoutDialogInitialWeek.set(weekIndex);
    this.workoutDialogOpen.set(true);
  }

  openEditWorkout(workout: ProgramWorkout): void {
    this.workoutDialogTarget.set(workout);
    this.workoutDialogInitialWeek.set(null);
    this.workoutDialogOpen.set(true);
  }

  onWorkoutSaved(saved: ProgramWorkout): void {
    const p = this.program();
    if (!p) return;
    const existing = p.workouts ?? [];
    const idx = existing.findIndex((w) => w.id === saved.id);
    // PATCH responses don't include nested exercises — preserve them.
    const merged: ProgramWorkout =
      idx >= 0
        ? { ...existing[idx], ...saved, exercises: existing[idx].exercises }
        : { ...saved, exercises: saved.exercises ?? [] };
    const next =
      idx >= 0 ? existing.map((w, i) => (i === idx ? merged : w)) : [...existing, merged];
    this.program.set({ ...p, workouts: next });
    this.workoutDialogOpen.set(false);
  }

  confirmDeleteWorkout(workout: ProgramWorkout): void {
    const p = this.program();
    if (!p) return;
    this._confirmationService.confirm({
      header: 'Delete workout?',
      message: `<strong>${workout.name}</strong> and its exercises will be removed from this program.<br /> Client copies of already-assigned programs keep their data.`,
      acceptLabel: 'Delete',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteWorkout(workout),
    });
  }

  private _deleteWorkout(workout: ProgramWorkout): void {
    const p = this.program();
    if (!p) return;
    this._programService.removeWorkout(p.id, workout.id).subscribe({
      next: () => {
        const next = (p.workouts ?? []).filter((w) => w.id !== workout.id);
        this.program.set({ ...p, workouts: next });
        this._messageService.add({
          severity: 'success',
          summary: 'Workout deleted',
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't delete workout", 'Please try again.', err);
      },
    });
  }

  // ── Exercise CRUD ────────────────────────────────────────────────

  openExercisePicker(workout: ProgramWorkout): void {
    this.exercisePickerTarget.set(workout);
    this.exercisePickerOpen.set(true);
  }

  onExerciseAdded(saved: PrescribedExercise): void {
    const p = this.program();
    const target = this.exercisePickerTarget();
    if (!p || !target) return;
    const next = (p.workouts ?? []).map((w) =>
      w.id === target.id
        ? { ...w, exercises: [...(w.exercises ?? []), { ...saved, sets: saved.sets ?? [] }] }
        : w,
    );
    this.program.set({ ...p, workouts: next });
    this.exercisePickerOpen.set(false);
  }

  confirmDeleteExercise(workout: ProgramWorkout, ex: PrescribedExercise): void {
    const p = this.program();
    if (!p) return;
    const name = ex.exercise?.name ?? 'this exercise';
    this._confirmationService.confirm({
      header: 'Remove exercise?',
      message: `Remove <strong>${name}</strong> and its prescribed sets from ${workout.name}?<br /> Client copies of already-assigned programs keep their data.`,
      acceptLabel: 'Remove',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteExercise(workout, ex),
    });
  }

  private _deleteExercise(workout: ProgramWorkout, ex: PrescribedExercise): void {
    const p = this.program();
    if (!p) return;
    this._programService.removeExercise(p.id, workout.id, ex.id).subscribe({
      next: () => {
        const next = (p.workouts ?? []).map((w) =>
          w.id === workout.id
            ? {
                ...w,
                exercises: (w.exercises ?? []).filter((e) => e.id !== ex.id),
              }
            : w,
        );
        this.program.set({ ...p, workouts: next });
        this._messageService.add({
          severity: 'success',
          summary: 'Exercise removed',
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't remove exercise", 'Please try again.', err);
      },
    });
  }

  // ── Set CRUD ─────────────────────────────────────────────────────

  openAddSet(workout: ProgramWorkout, exercise: PrescribedExercise): void {
    this.setDialogTarget.set({ workout, exercise, set: null });
    this.setDialogOpen.set(true);
  }

  openEditSet(workout: ProgramWorkout, exercise: PrescribedExercise, set: PrescribedSet): void {
    this.setDialogTarget.set({ workout, exercise, set });
    this.setDialogOpen.set(true);
  }

  onSetSaved(saved: PrescribedSet): void {
    const p = this.program();
    const target = this.setDialogTarget();
    if (!p || !target) return;
    const next = (p.workouts ?? []).map((w) =>
      w.id === target.workout.id
        ? {
            ...w,
            exercises: (w.exercises ?? []).map((e) =>
              e.id === target.exercise.id ? { ...e, sets: this._mergeSet(e.sets ?? [], saved) } : e,
            ),
          }
        : w,
    );
    this.program.set({ ...p, workouts: next });
    this.setDialogOpen.set(false);
  }

  private _mergeSet(existing: PrescribedSet[], saved: PrescribedSet): PrescribedSet[] {
    const idx = existing.findIndex((s) => s.id === saved.id);
    if (idx >= 0) {
      return existing.map((s, i) => (i === idx ? saved : s));
    }
    return [...existing, saved].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  confirmDeleteSet(workout: ProgramWorkout, ex: PrescribedExercise, set: PrescribedSet): void {
    this._confirmationService.confirm({
      header: 'Remove set?',
      message: `Remove set ${set.orderIndex + 1}? This can't be undone — but client copies of already-assigned programs keep their data.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteSet(workout, ex, set),
    });
  }

  private _deleteSet(workout: ProgramWorkout, ex: PrescribedExercise, set: PrescribedSet): void {
    const p = this.program();
    if (!p) return;
    this._programService.removeSet(p.id, workout.id, ex.id, set.id).subscribe({
      next: () => {
        const next = (p.workouts ?? []).map((w) =>
          w.id === workout.id
            ? {
                ...w,
                exercises: (w.exercises ?? []).map((e) =>
                  e.id === ex.id
                    ? {
                        ...e,
                        sets: (e.sets ?? []).filter((s) => s.id !== set.id),
                      }
                    : e,
                ),
              }
            : w,
        );
        this.program.set({ ...p, workouts: next });
        this._messageService.add({
          severity: 'success',
          summary: 'Set removed',
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't remove set", 'Please try again.', err);
      },
    });
  }

  openAssign(): void {
    if (!this.program()) return;
    this.assignDialogOpen.set(true);
  }

  onAssigned(): void {
    // The dialog already toasted success. Nothing to refresh on the
    // program detail itself — assignment list lives elsewhere (FE-P4).
    this.assignDialogOpen.set(false);
  }

  confirmDelete(): void {
    const p = this.program();
    if (!p) return;
    this._confirmationService.confirm({
      header: 'Delete program?',
      message: `<strong>${p.name}</strong> will be removed from your library.<br /> Existing client assignments keep their copy, but you won't be able to assign it to new clients.`,
      acceptLabel: 'Delete',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteProgram(p.id),
    });
  }

  private _deleteProgram(id: string): void {
    this.deleting.set(true);
    this._programService.remove(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Program deleted',
          life: 2500,
        });
        this._router.navigate(['/coaching/programs']);
      },
      error: (err) => {
        this.deleting.set(false);
        showApiError(this._messageService, "Couldn't delete program", 'Please try again.', err);
      },
    });
  }

  // ── Header navigation / actions ──────────────────────────────────

  goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to the list.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/coaching/programs']);
    }
  }

  openActionsSheet(): void {
    this.actionsOpen.set(true);
  }

  onDetailAction(item: ActionItem): void {
    this.actionsOpen.set(false);
    switch (item.id) {
      case 'edit':
        this.openEdit();
        break;
      case 'assign':
        this.openAssign();
        break;
      case 'delete':
        this.confirmDelete();
        break;
    }
  }

  // ── Helpers for the template ─────────────────────────────────────

  statusSeverity(s: ProgramStatus): TagSeverity {
    switch (s) {
      case ProgramStatus.Published:
        return TagSeverity.Success;
      case ProgramStatus.Archived:
        return TagSeverity.Contrast;
      case ProgramStatus.Draft:
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  }

  trackSetById = (_: number, s: PrescribedSet): string => s.id;

  setTypeSeverity(s: ExerciseSetType): TagSeverity {
    switch (s) {
      case ExerciseSetType.Warmup:
        return TagSeverity.Info;
      case ExerciseSetType.Failure:
      case ExerciseSetType.Dropset:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  /** Human duration label — weeks when the day count divides evenly. */
  durationLabel(days: number): string {
    if (days % 7 === 0) {
      const weeks = days / 7;
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  setSummary(s: PrescribedSet): string {
    const parts: string[] = [];
    if (s.targetRepsMin != null && s.targetRepsMax != null) {
      parts.push(
        s.targetRepsMin === s.targetRepsMax
          ? `${s.targetRepsMin} reps`
          : `${s.targetRepsMin}–${s.targetRepsMax} reps`,
      );
    } else if (s.targetRepsMin != null) {
      parts.push(`${s.targetRepsMin}+ reps`);
    }
    if (s.targetWeightKg != null) parts.push(`${s.targetWeightKg} kg`);
    else if (s.targetWeightPercent1rm != null) parts.push(`${s.targetWeightPercent1rm}% 1RM`);
    if (s.targetDurationSeconds != null) parts.push(`${s.targetDurationSeconds}s`);
    if (s.targetDistanceMeters != null) parts.push(`${s.targetDistanceMeters}m`);
    if (s.targetRpe != null) parts.push(`RPE ${s.targetRpe}`);
    if (s.targetRir != null) parts.push(`${s.targetRir} RIR`);
    return parts.length ? parts.join(' · ') : '—';
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this._programService.get(id).subscribe({
      next: (p) => {
        this.program.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        // Always release loading — RxJS `complete` doesn't fire after `error`.
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load program",
          'It may have been removed or you may not have access.',
          err,
        );
        this._router.navigate(['/coaching/programs']);
      },
    });
  }
}
