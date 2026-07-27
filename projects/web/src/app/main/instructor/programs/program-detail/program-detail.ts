import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { Button } from 'primeng/button';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Toast } from 'primeng/toast';
import { Tag } from 'primeng/tag';
import { TableModule, TableRowReorderEvent } from 'primeng/table';
import { Chip } from 'primeng/chip';
import { Tooltip } from 'primeng/tooltip';
import { forkJoin, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';

import {
  ActionItem,
  ActionList,
  BottomSheet,
  CreatePrescribedSetPayload,
  ExerciseSetType,
  PrescribedExercise,
  PrescribedSet,
  Program,
  ProgramService,
  ProgramStatus,
  ProgramWorkout,
  STORAGE_KEYS,
  TagSeverity,
  getProgramStatusSeverity,
  injectIsMobile,
  injectIsTablet,
  showApiError,
} from 'core';

import { KpiCard } from '../../../../_shared/components/kpi-card/kpi-card';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { AssignProgramDialog } from '../assign-program-dialog/assign-program-dialog';
import { ExercisePickerDialog } from '../exercise-picker-dialog/exercise-picker-dialog';
import {
  MoveTargetChoice,
  MoveTargetDialog,
} from '../move-target-dialog/move-target-dialog';
import { ProgramFormDialog } from '../program-form-dialog/program-form-dialog';
import { SetFormDialog } from '../set-form-dialog/set-form-dialog';
import { WorkoutFormDialog } from '../workout-form-dialog/workout-form-dialog';

/**
 * Program detail — the coach-side program builder.
 *
 * Full nested tree from `GET /programs/:id`. Owner-only on the BE,
 * so we don't gate roles here — the BE 404s cross-instructor probes.
 * All mutations update the tree optimistically and resync on failure.
 */
@Component({
  selector: 'mh-program-detail',
  imports: [
    TitleCasePipe,
    Button,
    ConfirmDialog,
    Menu,
    Toast,
    Tag,
    // No standalone export for Table + its reorder directives — module fallback.
    TableModule,
    Chip,
    Tooltip,
    ActionList,
    BottomSheet,
    KpiCard,
    ListEmptyState,
    AssignProgramDialog,
    ExercisePickerDialog,
    MoveTargetDialog,
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

  // ── Collapse state (Part A) ──────────────────────────────────────
  // Absent id = expanded (default), `false` = collapsed. Persisted per
  // program in localStorage so big programs stay compact across visits.

  readonly expandedWorkouts = signal<Record<string, boolean>>({});
  readonly expandedExercises = signal<Record<string, boolean>>({});

  // ── Move menu + cross-container dialog (Part B) ──────────────────

  readonly moveMenuItems = signal<MenuItem[]>([]);
  private readonly _moveMenu = viewChild<Menu>('moveMenu');

  readonly moveTargetDialogOpen = signal(false);
  readonly moveTargetMode = signal<'workout' | 'exercise'>('workout');
  /** Workout being moved (workout mode) / source workout (exercise mode). */
  readonly moveTargetSourceWorkout = signal<ProgramWorkout | null>(null);
  readonly moveTargetExercise = signal<PrescribedExercise | null>(null);

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
  readonly detailActions: ActionItem[] = [
    { id: 'edit', icon: 'pi pi-pencil', label: 'Edit program' },
    { id: 'assign', icon: 'pi pi-user-plus', label: 'Assign to client' },
    { id: 'delete', icon: 'pi pi-trash', label: 'Delete program…', danger: true },
  ];

  ngOnInit(): void {
    // The codebase reads route params via ActivatedRoute snapshot
    // (input binding via `withComponentInputBinding()` is NOT wired
    // in app.config.ts). Single-shot read is enough — navigating to
    // a different program id always re-mounts the component because
    // there are no sibling routes that would reuse it.
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this._fetch(id);
    else this._router.navigate(['/coaching/programs']);
  }

  // ── Program edit ─────────────────────────────────────────────────

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

  /**
   * Reorder a workout within its week — driven by the Move… menu. The
   * week's occupied day slots stay fixed (a Mon/Wed/Fri week stays
   * Mon/Wed/Fri) — moving permutes which workout sits on which of
   * those days, and the BE applies the whole permutation in one
   * transaction. Cross-week moves go through the Move dialog.
   */
  moveWorkout(week: number, from: number, to: number): void {
    const p = this.program();
    const group = this.weeks().find((g) => g.week === week);
    if (!p || !group) return;
    const count = group.workouts.length;
    const target = Math.max(0, Math.min(count - 1, to));
    if (from < 0 || from >= count || from === target) return;

    // `weeks()` renders day-ascending, so this is the slot list in
    // visual order; occupant i inherits slot i after the move.
    const days = group.workouts.map((w) => w.dayIndex);
    const reordered = [...group.workouts];
    moveItemInArray(reordered, from, target);
    const items = reordered.map((w, i) => ({
      id: w.id,
      weekIndex: week,
      dayIndex: days[i],
    }));
    const moved = items.filter((it, i) => reordered[i].dayIndex !== it.dayIndex);
    if (moved.length === 0) return;

    // Optimistic: assign the permuted slots locally (weeks() re-sorts).
    const dayById = new Map(moved.map((it) => [it.id, it.dayIndex]));
    this.program.set({
      ...p,
      workouts: (p.workouts ?? []).map((w) =>
        dayById.has(w.id) ? { ...w, dayIndex: dayById.get(w.id)! } : w,
      ),
    });

    this._programService.reorderWorkouts(p.id, { items: moved }).subscribe({
      next: (all) => {
        // Merge the authoritative slots + recomputed sequenceNumber,
        // preserving the nested exercises the reorder response omits.
        const cur = this.program();
        if (!cur) return;
        const byId = new Map(all.map((w) => [w.id, w]));
        this.program.set({
          ...cur,
          workouts: (cur.workouts ?? []).map((w) => {
            const fresh = byId.get(w.id);
            return fresh
              ? {
                  ...w,
                  weekIndex: fresh.weekIndex,
                  dayIndex: fresh.dayIndex,
                  sequenceNumber: fresh.sequenceNumber,
                }
              : w;
          }),
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't save the new order", 'Please try again.', err);
        this._refetch();
      },
    });
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

  /**
   * The picker emits every exercise created by one confirm. On partial
   * failure it emits what landed and stays open for a retry, so the
   * dialog owns its own closing — don't force it shut here.
   */
  onExercisesAdded(saved: PrescribedExercise[]): void {
    const p = this.program();
    const target = this.exercisePickerTarget();
    if (!p || !target || saved.length === 0) return;
    const rows = saved.map((s) => ({ ...s, sets: s.sets ?? [] }));
    const next = (p.workouts ?? []).map((w) =>
      w.id === target.id ? { ...w, exercises: [...(w.exercises ?? []), ...rows] } : w,
    );
    this.program.set({ ...p, workouts: next });
  }

  /** Reorder an exercise within its workout — driven by the Move… menu. */
  moveExercise(workout: ProgramWorkout, from: number, to: number): void {
    const list = workout.exercises ?? [];
    const target = Math.max(0, Math.min(list.length - 1, to));
    if (from < 0 || from >= list.length || from === target) return;
    const reordered = [...list];
    moveItemInArray(reordered, from, target);
    this._applyExerciseOrder(workout, reordered);
  }

  /**
   * Persist a new exercise order. `ordered` is the target visual order;
   * each row still carries its stale `orderIndex`, which is how the
   * changed set is detected. Optimistic local update, one PATCH per
   * changed row, full resync on failure.
   */
  private _applyExerciseOrder(workout: ProgramWorkout, ordered: PrescribedExercise[]): void {
    const p = this.program();
    if (!p) return;
    const renumbered = ordered.map((e, i) => ({ ...e, orderIndex: i }));
    const changed = renumbered.filter((e, i) => ordered[i].orderIndex !== i);

    this.program.set({
      ...p,
      workouts: (p.workouts ?? []).map((w) =>
        w.id === workout.id ? { ...w, exercises: renumbered } : w,
      ),
    });
    if (changed.length === 0) return;
    forkJoin(
      changed.map((e) =>
        this._programService.updateExercise(p.id, workout.id, e.id, {
          orderIndex: e.orderIndex,
        }),
      ),
    ).subscribe({
      error: (err) => {
        showApiError(this._messageService, "Couldn't save the new order", 'Please try again.', err);
        this._refetch();
      },
    });
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

  /**
   * The set dialog emits every set touched by one submit (N created
   * rows, or the edited one). Like the picker, it owns its own closing
   * so partial failures can keep it open for a retry.
   */
  onSetsSaved(saved: PrescribedSet[]): void {
    const p = this.program();
    const target = this.setDialogTarget();
    if (!p || !target || saved.length === 0) return;
    const next = (p.workouts ?? []).map((w) =>
      w.id === target.workout.id
        ? {
            ...w,
            exercises: (w.exercises ?? []).map((e) =>
              e.id === target.exercise.id
                ? {
                    ...e,
                    sets: saved.reduce((acc, s) => this._mergeSet(acc, s), e.sets ?? []),
                  }
                : e,
            ),
          }
        : w,
    );
    this.program.set({ ...p, workouts: next });
  }

  /** Field-for-field copy payload — used by duplicate + cross-workout move. */
  private _setToPayload(set: PrescribedSet): CreatePrescribedSetPayload {
    return {
      setType: set.setType,
      ...(set.targetRepsMin != null ? { targetRepsMin: set.targetRepsMin } : {}),
      ...(set.targetRepsMax != null ? { targetRepsMax: set.targetRepsMax } : {}),
      ...(set.targetWeightKg != null ? { targetWeightKg: set.targetWeightKg } : {}),
      ...(set.targetWeightPercent1rm != null
        ? { targetWeightPercent1rm: set.targetWeightPercent1rm }
        : {}),
      ...(set.targetDurationSeconds != null
        ? { targetDurationSeconds: set.targetDurationSeconds }
        : {}),
      ...(set.targetDistanceMeters != null
        ? { targetDistanceMeters: set.targetDistanceMeters }
        : {}),
      ...(set.targetRpe != null ? { targetRpe: set.targetRpe } : {}),
      ...(set.targetRir != null ? { targetRir: set.targetRir } : {}),
      ...(set.restAfterSeconds != null ? { restAfterSeconds: set.restAfterSeconds } : {}),
      ...(set.tempo ? { tempo: set.tempo } : {}),
      ...(set.notes ? { notes: set.notes } : {}),
    };
  }

  /** Clone a set as-is; the BE appends it (orderIndex = max + 1). */
  duplicateSet(workout: ProgramWorkout, ex: PrescribedExercise, set: PrescribedSet): void {
    const p = this.program();
    if (!p) return;
    this._programService.addSet(p.id, workout.id, ex.id, this._setToPayload(set)).subscribe({
      next: (created) => {
        const cur = this.program();
        if (!cur) return;
        const next = (cur.workouts ?? []).map((w) =>
          w.id === workout.id
            ? {
                ...w,
                exercises: (w.exercises ?? []).map((e) =>
                  e.id === ex.id ? { ...e, sets: this._mergeSet(e.sets ?? [], created) } : e,
                ),
              }
            : w,
        );
        this.program.set({ ...cur, workouts: next });
        this._messageService.add({
          severity: 'success',
          summary: 'Set duplicated',
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't duplicate set", 'Please try again.', err);
      },
    });
  }

  /**
   * Row drag inside the sets table. PrimeNG has already reordered the
   * bound array in place — it IS the target order.
   */
  onSetsReordered(workout: ProgramWorkout, ex: PrescribedExercise, _event: TableRowReorderEvent): void {
    this._applySetOrder(workout, ex, ex.sets ?? []);
  }

  /**
   * Persist a new set order. Same contract as `_applyExerciseOrder`:
   * `ordered` is the target visual order with stale `orderIndex`
   * fields, which is how the changed rows are detected.
   */
  private _applySetOrder(
    workout: ProgramWorkout,
    ex: PrescribedExercise,
    ordered: PrescribedSet[],
  ): void {
    const p = this.program();
    if (!p) return;
    const renumbered = ordered.map((s, i) => ({ ...s, orderIndex: i }));
    const changed = renumbered.filter((s, i) => ordered[i].orderIndex !== i);

    this.program.set({
      ...p,
      workouts: (p.workouts ?? []).map((w) =>
        w.id === workout.id
          ? {
              ...w,
              exercises: (w.exercises ?? []).map((e) =>
                e.id === ex.id ? { ...e, sets: renumbered } : e,
              ),
            }
          : w,
      ),
    });
    if (changed.length === 0) return;
    forkJoin(
      changed.map((s) =>
        this._programService.updateSet(p.id, workout.id, ex.id, s.id, {
          orderIndex: s.orderIndex,
        }),
      ),
    ).subscribe({
      error: (err) => {
        showApiError(this._messageService, "Couldn't save the new order", 'Please try again.', err);
        this._refetch();
      },
    });
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

  // ── Move menu + cross-container moves (Part B) ───────────────────

  openWorkoutMoveMenu(
    event: MouseEvent,
    week: number,
    index: number,
    count: number,
    workout: ProgramWorkout,
  ): void {
    this.moveMenuItems.set([
      ...this._orderMenuItems(index, count, (to) => this.moveWorkout(week, index, to)),
      { separator: true },
      {
        label: 'Move to another week/day…',
        icon: 'pi pi-calendar',
        command: () => this.openMoveWorkoutDialog(workout),
      },
    ]);
    this._moveMenu()?.toggle(event);
  }

  openExerciseMoveMenu(
    event: MouseEvent,
    workout: ProgramWorkout,
    index: number,
    count: number,
    ex: PrescribedExercise,
  ): void {
    this.moveMenuItems.set([
      ...this._orderMenuItems(index, count, (to) => this.moveExercise(workout, index, to)),
      { separator: true },
      {
        label: 'Move to another workout…',
        icon: 'pi pi-arrow-right-arrow-left',
        disabled: (this.program()?.workouts?.length ?? 0) < 2,
        command: () => this.openMoveExerciseDialog(workout, ex),
      },
    ]);
    this._moveMenu()?.toggle(event);
  }

  /** Up / down / top / bottom — shared shape for both menu flavours. */
  private _orderMenuItems(index: number, count: number, move: (to: number) => void): MenuItem[] {
    return [
      {
        label: 'Move up',
        icon: 'pi pi-arrow-up',
        disabled: index === 0,
        command: () => move(index - 1),
      },
      {
        label: 'Move down',
        icon: 'pi pi-arrow-down',
        disabled: index === count - 1,
        command: () => move(index + 1),
      },
      {
        label: 'Move to top',
        icon: 'pi pi-angle-double-up',
        disabled: index === 0,
        command: () => move(0),
      },
      {
        label: 'Move to bottom',
        icon: 'pi pi-angle-double-down',
        disabled: index === count - 1,
        command: () => move(count - 1),
      },
    ];
  }

  openMoveWorkoutDialog(workout: ProgramWorkout): void {
    this.moveTargetMode.set('workout');
    this.moveTargetSourceWorkout.set(workout);
    this.moveTargetExercise.set(null);
    this.moveTargetDialogOpen.set(true);
  }

  openMoveExerciseDialog(workout: ProgramWorkout, ex: PrescribedExercise): void {
    this.moveTargetMode.set('exercise');
    this.moveTargetSourceWorkout.set(workout);
    this.moveTargetExercise.set(ex);
    this.moveTargetDialogOpen.set(true);
  }

  onMoveTargetChosen(choice: MoveTargetChoice): void {
    const source = this.moveTargetSourceWorkout();
    if (!source) return;
    if (choice.kind === 'slot') {
      this._moveWorkoutToSlot(source, choice.weekIndex, choice.dayIndex);
    } else {
      const ex = this.moveTargetExercise();
      if (ex) this._moveExerciseToWorkout(source, ex, choice.workoutId);
    }
  }

  /** Cross-week/day move — one PATCH; the BE 409s if the slot got taken. */
  private _moveWorkoutToSlot(workout: ProgramWorkout, weekIndex: number, dayIndex: number): void {
    const p = this.program();
    if (!p) return;
    this._programService.updateWorkout(p.id, workout.id, { weekIndex, dayIndex }).subscribe({
      next: (updated) => {
        const cur = this.program();
        if (!cur) return;
        this.program.set({
          ...cur,
          workouts: (cur.workouts ?? []).map((w) =>
            w.id === workout.id ? { ...w, ...updated, exercises: w.exercises } : w,
          ),
        });
        this._messageService.add({
          severity: 'success',
          summary: 'Workout moved',
          detail: `${updated.name} → week ${weekIndex + 1}, day ${dayIndex + 1}.`,
          life: 2500,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't move workout", 'Please try again.', err);
      },
    });
  }

  /**
   * Cross-workout exercise move. The BE has no "reparent" operation on
   * prescribed exercises, so this is copy-then-delete: create the slot
   * in the destination (lands at the end), copy its sets one by one,
   * then remove the original. If copying fails midway the half-created
   * destination row is cleaned up best-effort and the tree resyncs.
   */
  private _moveExerciseToWorkout(
    source: ProgramWorkout,
    ex: PrescribedExercise,
    targetWorkoutId: string,
  ): void {
    const p = this.program();
    if (!p || targetWorkoutId === source.id) return;
    const sets = ex.sets ?? [];

    this._programService
      .addExercise(p.id, targetWorkoutId, {
        exerciseId: ex.exerciseId,
        ...(ex.notes ? { notes: ex.notes } : {}),
        ...(ex.alternateExerciseId ? { alternateExerciseId: ex.alternateExerciseId } : {}),
      })
      .pipe(
        concatMap((created) =>
          from(sets).pipe(
            concatMap((s) =>
              this._programService.addSet(p.id, targetWorkoutId, created.id, this._setToPayload(s)),
            ),
            toArray(),
            map((createdSets) => ({ created, createdSets })),
            catchError((err) =>
              this._programService.removeExercise(p.id, targetWorkoutId, created.id).pipe(
                catchError(() => of(void 0)),
                concatMap(() => throwError(() => err)),
              ),
            ),
          ),
        ),
        concatMap(({ created, createdSets }) =>
          this._programService
            .removeExercise(p.id, source.id, ex.id)
            .pipe(map(() => ({ created, createdSets }))),
        ),
      )
      .subscribe({
        next: ({ created, createdSets }) => {
          const cur = this.program();
          if (!cur) return;
          const moved: PrescribedExercise = {
            ...created,
            exercise: ex.exercise,
            sets: createdSets,
          };
          this.program.set({
            ...cur,
            workouts: (cur.workouts ?? []).map((w) => {
              if (w.id === source.id) {
                return { ...w, exercises: (w.exercises ?? []).filter((e) => e.id !== ex.id) };
              }
              if (w.id === targetWorkoutId) {
                return { ...w, exercises: [...(w.exercises ?? []), moved] };
              }
              return w;
            }),
          });
          this._messageService.add({
            severity: 'success',
            summary: 'Exercise moved',
            detail: ex.exercise?.name ?? undefined,
            life: 2500,
          });
        },
        error: (err) => {
          showApiError(this._messageService, "Couldn't move exercise", 'Please try again.', err);
          this._refetch();
        },
      });
  }

  // ── Collapse state (Part A) ──────────────────────────────────────

  isWorkoutExpanded(id: string): boolean {
    return this.expandedWorkouts()[id] !== false;
  }

  isExerciseExpanded(id: string): boolean {
    return this.expandedExercises()[id] !== false;
  }

  toggleWorkoutExpanded(workout: ProgramWorkout): void {
    this.expandedWorkouts.update((cur) => ({
      ...cur,
      [workout.id]: !this.isWorkoutExpanded(workout.id),
    }));
    this._saveExpandedState();
  }

  toggleExerciseExpanded(ex: PrescribedExercise): void {
    this.expandedExercises.update((cur) => ({
      ...cur,
      [ex.id]: !this.isExerciseExpanded(ex.id),
    }));
    this._saveExpandedState();
  }

  /** True once every workout in the week is collapsed — flips the toggle. */
  isWeekCollapsed(workouts: ProgramWorkout[]): boolean {
    return workouts.every((w) => !this.isWorkoutExpanded(w.id));
  }

  /** Week-level toggle: collapse all while anything is open, else expand all. */
  toggleWeekExpanded(workouts: ProgramWorkout[]): void {
    this._setWeekExpanded(workouts, this.isWeekCollapsed(workouts));
  }

  private _setWeekExpanded(workouts: ProgramWorkout[], expanded: boolean): void {
    this.expandedWorkouts.update((cur) => {
      const next = { ...cur };
      for (const w of workouts) next[w.id] = expanded;
      return next;
    });
    this._saveExpandedState();
  }

  /** Sets prescribed across a whole workout — the collapsed-header summary. */
  workoutSetCount(workout: ProgramWorkout): number {
    let n = 0;
    for (const e of workout.exercises ?? []) n += e.sets?.length ?? 0;
    return n;
  }

  private _saveExpandedState(): void {
    const p = this.program();
    if (!p) return;
    try {
      // Store only the collapsed entries, pruned to ids still in the
      // tree, so deleted workouts don't accumulate forever.
      const workoutIds = new Set((p.workouts ?? []).map((w) => w.id));
      const exerciseIds = new Set(
        (p.workouts ?? []).flatMap((w) => (w.exercises ?? []).map((e) => e.id)),
      );
      const collapsedOnly = (
        state: Record<string, boolean>,
        keep: Set<string>,
      ): Record<string, boolean> =>
        Object.fromEntries(
          Object.entries(state).filter(([id, v]) => v === false && keep.has(id)),
        );
      localStorage.setItem(
        STORAGE_KEYS.PROGRAM_BUILDER_EXPANDED(p.id),
        JSON.stringify({
          workouts: collapsedOnly(this.expandedWorkouts(), workoutIds),
          exercises: collapsedOnly(this.expandedExercises(), exerciseIds),
        }),
      );
    } catch {
      // Storage unavailable (private mode / quota) — collapse state
      // simply won't survive a reload.
    }
  }

  private _restoreExpandedState(programId: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRAM_BUILDER_EXPANDED(programId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        workouts?: Record<string, boolean>;
        exercises?: Record<string, boolean>;
      };
      this.expandedWorkouts.set(parsed.workouts ?? {});
      this.expandedExercises.set(parsed.exercises ?? {});
    } catch {
      // Corrupt entry — fall back to everything expanded.
    }
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
    return getProgramStatusSeverity(s);
  }

  readonly trackSetById = (_: number, s: PrescribedSet): string => s.id;

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

  /** Pull the full tree again — used to resync after a failed reorder. */
  private _refetch(): void {
    const p = this.program();
    if (p) this._fetch(p.id);
  }

  private _fetch(id: string): void {
    this.loading.set(true);
    this._programService.get(id).subscribe({
      next: (p) => {
        this.program.set(p);
        this._restoreExpandedState(p.id);
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
