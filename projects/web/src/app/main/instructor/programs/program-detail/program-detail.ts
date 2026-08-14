import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Location, TitleCasePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonDirective } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { Observable, defer, forkJoin, from, of, throwError } from 'rxjs';
import { catchError, concatMap, finalize, map, toArray } from 'rxjs/operators';

import {
  ActionItem,
  ActionList,
  BottomSheet,
  CreatePrescribedSetPayload,
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

import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { AssignProgramDialog } from '../assign-program-dialog/assign-program-dialog';
import { ExercisePickerDialog } from '../exercise-picker-dialog/exercise-picker-dialog';
import { MoveTargetChoice, MoveTargetDialog } from '../move-target-dialog/move-target-dialog';
import { ProgramFormDialog } from '../program-form-dialog/program-form-dialog';
import { SetFormDialog } from '../set-form-dialog/set-form-dialog';
import { WorkoutFormDialog } from '../workout-form-dialog/workout-form-dialog';
import {
  BuilderRail,
  RailWeekDrop,
  RailWorkoutDrop,
} from './_components/builder-rail/builder-rail';
import { WeekGroup, nearestFreeDay, workoutSetCount } from './_components/builder.utils';
import { WorkoutEditor } from './_components/workout-editor/workout-editor';

/**
 * Program detail — the coach-side program builder, as a two-pane layout:
 * a persistent outline rail (weeks → workouts) on the left and exactly
 * one workout being edited on the right. On mobile the panes swap in
 * place (one at a time), driven by the `?workout=` query param.
 *
 * Full nested tree from `GET /programs/:id`. Owner-only on the BE,
 * so we don't gate roles here — the BE 404s cross-instructor probes.
 * All mutations update the tree optimistically and resync on failure.
 */
@Component({
  selector: 'mh-program-detail',
  imports: [
    TitleCasePipe,
    ButtonDirective,
    ConfirmDialog,
    Toast,
    Tag,
    Tooltip,
    ActionList,
    BottomSheet,
    ListEmptyState,
    AssignProgramDialog,
    ExercisePickerDialog,
    MoveTargetDialog,
    ProgramFormDialog,
    SetFormDialog,
    WorkoutFormDialog,
    BuilderRail,
    WorkoutEditor,
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

  // ── Cross-container move dialog ──────────────────────────────────

  readonly moveTargetDialogOpen = signal(false);
  readonly moveTargetMode = signal<'workout' | 'exercise'>('workout');
  /** Workout being moved (workout mode) / source workout (exercise mode). */
  readonly moveTargetSourceWorkout = signal<ProgramWorkout | null>(null);
  readonly moveTargetExercise = signal<PrescribedExercise | null>(null);

  // ── Rail collapse state — persisted per program in localStorage ──

  readonly collapsedWeeks = signal<ReadonlySet<number>>(new Set());

  // ── Saving pill — counts container-initiated mutations in flight ─
  // Dialog-internal saves (workout form, set form, picker) sit under a
  // modal with their own spinners, so they're deliberately not counted.

  private readonly _pendingMutations = signal(0);
  readonly saving = computed(() => this._pendingMutations() > 0);

  // ── Selection — synced to the `?workout=` query param ────────────

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly orderedWorkouts = computed<ProgramWorkout[]>(() =>
    [...(this.program()?.workouts ?? [])].sort(
      (a, b) => a.weekIndex - b.weekIndex || a.dayIndex - b.dayIndex,
    ),
  );

  /** Non-null only when `?workout=<id>` resolves to a real workout. */
  readonly explicitWorkoutId = computed(() => {
    const id = this._queryParams()?.get('workout');
    return id && this.orderedWorkouts().some((w) => w.id === id) ? id : null;
  });

  /** Desktop falls back to the first workout; mobile shows the rail instead. */
  readonly activeWorkout = computed<ProgramWorkout | null>(() => {
    const explicit = this.explicitWorkoutId();
    if (explicit) return this.orderedWorkouts().find((w) => w.id === explicit) ?? null;
    return this.isMobile() ? null : (this.orderedWorkouts()[0] ?? null);
  });

  // ── Derived data for the rail + header ───────────────────────────

  /**
   * All weeks INCLUDING empty ones, so empty weeks can receive workouts.
   * Count = max(duration-derived, highest week in use) — a duration
   * shrink never hides weeks that still hold workouts. Open-ended
   * programs (durationDays = null) show only the weeks in use.
   */
  readonly weeks = computed<WeekGroup[]>(() => {
    const p = this.program();
    const all = p?.workouts ?? [];
    const byWeek = new Map<number, ProgramWorkout[]>();
    for (const w of all) {
      const arr = byWeek.get(w.weekIndex) ?? [];
      arr.push(w);
      byWeek.set(w.weekIndex, arr);
    }
    const maxUsed = all.length ? Math.max(...all.map((w) => w.weekIndex)) + 1 : 0;
    const fromDuration = p?.durationDays ? Math.ceil(p.durationDays / 7) : 0;
    // Always at least one week. Duration is optional on the create form,
    // so a fresh shell has none, and without this the builder rail opens
    // completely empty with nowhere to put the first workout. Week 1 is
    // structure, not invented data: it does not set `durationDays`,
    // which drives the assignment end date.
    return Array.from({ length: Math.max(fromDuration, maxUsed, 1) }, (_, week) => ({
      week,
      workouts: (byWeek.get(week) ?? []).sort((a, b) => a.dayIndex - b.dayIndex),
    }));
  });

  readonly weekCount = computed(() => this.weeks().length);
  readonly totalWorkouts = computed(() => this.program()?.workouts?.length ?? 0);

  /** Position of the active workout in its week — drives move up/down. */
  readonly activeWorkoutPosition = computed(() => {
    const w = this.activeWorkout();
    const group = w ? this.weeks().find((g) => g.week === w.weekIndex) : undefined;
    const idx = group?.workouts.findIndex((x) => x.id === w?.id) ?? -1;
    return {
      indexInWeek: Math.max(0, idx),
      weekWorkoutCount: group?.workouts.length ?? 0,
    };
  });

  /** Total sets in the active workout's week — the header meta line. */
  readonly selectedWeekSetCount = computed(() => {
    const w = this.activeWorkout();
    const group = w ? this.weeks().find((g) => g.week === w.weekIndex) : undefined;
    if (!group) return null;
    return group.workouts.reduce((n, x) => n + workoutSetCount(x), 0);
  });

  /** Action-sheet rows for the mobile ⋮ menu — mirror the desktop header buttons. */
  readonly detailActions: ActionItem[] = [
    { id: 'edit', icon: 'pi pi-pencil', label: 'Edit program' },
    { id: 'assign', icon: 'pi pi-user-plus', label: 'Assign to client' },
    { id: 'delete', icon: 'pi pi-trash', label: 'Delete program…', danger: true },
  ];

  /** Reveal key already handled — `id:weekIndex`, so a cross-week move re-reveals. */
  private _lastReveal: string | null = null;

  constructor() {
    // Reveal the selected workout's week in the rail — covers deep links
    // and cross-week moves landing in a collapsed week. Keyed so the coach
    // can still collapse the active week manually without it snapping open.
    effect(() => {
      const w = this.activeWorkout();
      if (!w) {
        this._lastReveal = null;
        return;
      }
      const key = `${w.id}:${w.weekIndex}`;
      if (key === this._lastReveal) return;
      this._lastReveal = key;
      if (this.collapsedWeeks().has(w.weekIndex)) {
        this.collapsedWeeks.update((cur) => {
          const next = new Set(cur);
          next.delete(w.weekIndex);
          return next;
        });
        this._saveRailState();
      }
    });
  }

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

  // ── Selection ────────────────────────────────────────────────────

  selectWorkout(id: string, replaceUrl = false): void {
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { workout: id },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /** Mobile back to the outline; also the "no neighbor left" fallback. */
  closeEditor(replaceUrl = false): void {
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { workout: null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  moveActiveWorkout(delta: -1 | 1): void {
    const w = this.activeWorkout();
    if (!w) return;
    const pos = this.activeWorkoutPosition();
    this.moveWorkout(w.weekIndex, pos.indexInWeek, pos.indexInWeek + delta);
  }

  // ── Rail collapse state ──────────────────────────────────────────

  toggleWeekCollapsed(week: number): void {
    this.collapsedWeeks.update((cur) => {
      const next = new Set(cur);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
    this._saveRailState();
  }

  private _saveRailState(): void {
    const p = this.program();
    if (!p) return;
    try {
      // Prune to weeks that still exist so stale indexes don't accumulate.
      const weekCount = this.weeks().length;
      localStorage.setItem(
        STORAGE_KEYS.PROGRAM_BUILDER_EXPANDED(p.id),
        JSON.stringify({ collapsedWeeks: [...this.collapsedWeeks()].filter((w) => w < weekCount) }),
      );
    } catch {
      // Storage unavailable (private mode / quota) — collapse state
      // simply won't survive a reload.
    }
  }

  private _restoreRailState(programId: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRAM_BUILDER_EXPANDED(programId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { collapsedWeeks?: unknown };
      // The pre-redesign schema stored per-id workout/exercise maps —
      // it parses to `undefined` here and falls through to "all expanded".
      if (!Array.isArray(parsed.collapsedWeeks)) return;
      const weekCount = this.weeks().length;
      this.collapsedWeeks.set(
        new Set(
          parsed.collapsedWeeks.filter(
            (w): w is number => typeof w === 'number' && w >= 0 && w < weekCount,
          ),
        ),
      );
    } catch {
      // Corrupt entry — fall back to everything expanded.
    }
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
    const isCreate = this.workoutDialogTarget() === null;
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
    // Jump the editor to the freshly created workout.
    if (isCreate) this.selectWorkout(saved.id);
  }

  /**
   * Reorder a workout within its week — driven by the editor's up/down
   * buttons and same-week rail drags. The week's occupied day slots stay
   * fixed (a Mon/Wed/Fri week stays Mon/Wed/Fri) — moving permutes which
   * workout sits on which of those days, and the BE applies the whole
   * permutation in one transaction. Cross-week moves go through the
   * Move dialog or a cross-week rail drag.
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
    this._persistSlots(moved);
  }

  // ── Rail drag & drop ─────────────────────────────────────────────

  onRailWorkoutDropped(e: RailWorkoutDrop): void {
    if (e.fromWeek === e.toWeek) this.moveWorkout(e.fromWeek, e.fromIndex, e.toIndex);
    else this._moveWorkoutCrossWeek(e);
  }

  onRailWeekDropped(e: RailWeekDrop): void {
    this._reorderWeeks(e.fromIndex, e.toIndex);
  }

  /**
   * Cross-week drag — the workout lands at the drop position and takes
   * the nearest free day that keeps that visual order; the target
   * week's day pattern is untouched.
   */
  private _moveWorkoutCrossWeek(e: RailWorkoutDrop): void {
    const p = this.program();
    const target = this.weeks().find((g) => g.week === e.toWeek);
    const workout = (p?.workouts ?? []).find((w) => w.id === e.workoutId);
    if (!p || !target || !workout) return;

    const day = nearestFreeDay(
      target.workouts.map((w) => w.dayIndex),
      e.toIndex,
    );
    if (day === null) {
      // The rail's enter predicate normally blocks full weeks — this
      // covers a stale layout (e.g. another session filled the week).
      this._messageService.add({
        severity: 'warn',
        summary: 'Week is full',
        detail: 'A week holds at most 7 workouts.',
        life: 2500,
      });
      return;
    }

    // Reveal the destination so the workout doesn't vanish into a collapsed week.
    if (this.collapsedWeeks().has(e.toWeek)) this.toggleWeekCollapsed(e.toWeek);

    this._persistSlots([{ id: workout.id, weekIndex: e.toWeek, dayIndex: day }], {
      summary: 'Workout moved',
      detail: `${workout.name} → week ${e.toWeek + 1}, day ${day + 1}.`,
    });
  }

  /**
   * Weeks are buckets, not entities — reordering rewrites `weekIndex`
   * on every workout of every week whose position changed, in one
   * atomic reorder call. Day patterns are untouched.
   */
  private _reorderWeeks(from: number, to: number): void {
    const p = this.program();
    const groups = this.weeks();
    if (!p || from === to) return;
    if (from < 0 || to < 0 || from >= groups.length || to >= groups.length) return;

    const order = groups.map((g) => g.week); // order[newPos] = oldWeek
    moveItemInArray(order, from, to);
    const newWeekByOld = new Map(order.map((oldWeek, newPos) => [oldWeek, newPos] as const));

    const items = (p.workouts ?? [])
      .filter((w) => newWeekByOld.get(w.weekIndex) !== w.weekIndex)
      .map((w) => ({ id: w.id, weekIndex: newWeekByOld.get(w.weekIndex)!, dayIndex: w.dayIndex }));

    this._persistSlots(items); // no-op when only empty buckets moved

    // Collapse flags are positional — they must travel with their buckets.
    this.collapsedWeeks.update(
      (cur) => new Set([...cur].map((week) => newWeekByOld.get(week) ?? week)),
    );
    this._saveRailState();
  }

  /**
   * Optimistically apply (week, day) slots locally, then persist them
   * atomically via the reorder endpoint. Shared by within-week reorder,
   * cross-week drag and week reorder. `next` merges the authoritative
   * slots + recomputed sequenceNumber, preserving the nested exercises
   * the reorder response omits.
   */
  private _persistSlots(
    items: { id: string; weekIndex: number; dayIndex: number }[],
    success?: { summary: string; detail: string },
  ): void {
    const p = this.program();
    if (!p || items.length === 0) return;

    const slotById = new Map(items.map((it) => [it.id, it]));
    this.program.set({
      ...p,
      workouts: (p.workouts ?? []).map((w) => {
        const slot = slotById.get(w.id);
        return slot ? { ...w, weekIndex: slot.weekIndex, dayIndex: slot.dayIndex } : w;
      }),
    });

    this._track(this._programService.reorderWorkouts(p.id, { items })).subscribe({
      next: (all) => {
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
        if (success) this._messageService.add({ severity: 'success', life: 2500, ...success });
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
    // Neighbor selection must be computed BEFORE the tree loses the workout.
    const ordered = this.orderedWorkouts();
    const idx = ordered.findIndex((w) => w.id === workout.id);
    const neighbor = ordered[idx + 1] ?? ordered[idx - 1] ?? null;
    const wasSelected = this.explicitWorkoutId() === workout.id;
    this._track(this._programService.removeWorkout(p.id, workout.id)).subscribe({
      next: () => {
        const next = (p.workouts ?? []).filter((w) => w.id !== workout.id);
        this.program.set({ ...p, workouts: next });
        if (wasSelected) {
          if (neighbor) this.selectWorkout(neighbor.id, true);
          else this.closeEditor(true);
        }
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

  /** Reorder an exercise within its workout — driven by the row's up/down buttons. */
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
    this._track(
      forkJoin(
        changed.map((e) =>
          this._programService.updateExercise(p.id, workout.id, e.id, {
            orderIndex: e.orderIndex,
          }),
        ),
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
    this._track(this._programService.removeExercise(p.id, workout.id, ex.id)).subscribe({
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
    this._track(
      this._programService.addSet(p.id, workout.id, ex.id, this._setToPayload(set)),
    ).subscribe({
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

  /** Row drag inside a row's set table — `ordered` IS the target order. */
  onSetsReordered(workout: ProgramWorkout, ex: PrescribedExercise, ordered: PrescribedSet[]): void {
    this._applySetOrder(workout, ex, ordered);
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
    this._track(
      forkJoin(
        changed.map((s) =>
          this._programService.updateSet(p.id, workout.id, ex.id, s.id, {
            orderIndex: s.orderIndex,
          }),
        ),
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
    this._track(this._programService.removeSet(p.id, workout.id, ex.id, set.id)).subscribe({
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

  // ── Cross-container moves ────────────────────────────────────────

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
    this._track(
      this._programService.updateWorkout(p.id, workout.id, { weekIndex, dayIndex }),
    ).subscribe({
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

    this._track(
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
                this._programService.addSet(
                  p.id,
                  targetWorkoutId,
                  created.id,
                  this._setToPayload(s),
                ),
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
        ),
    ).subscribe({
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

  // ── Program-level actions ────────────────────────────────────────

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
    this._track(this._programService.remove(id)).subscribe({
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

  // ── Internals ────────────────────────────────────────────────────

  /** Count a container-initiated mutation for the header saving pill. */
  private _track<T>(source: Observable<T>): Observable<T> {
    return defer(() => {
      this._pendingMutations.update((n) => n + 1);
      return source.pipe(finalize(() => this._pendingMutations.update((n) => Math.max(0, n - 1))));
    });
  }

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
        this._restoreRailState(p.id);
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
