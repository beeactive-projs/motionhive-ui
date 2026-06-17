import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  Exercise,
  ExerciseService,
  LogSetPayload,
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  showApiError,
} from 'core';

import { ExercisePickerDialog } from '../../../instructor/programs/exercise-picker-dialog/exercise-picker-dialog';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

interface ExerciseState {
  ex: LoggedExercise;
  lastTime: LoggedSet[] | null; // null = not loaded yet
  loadingLastTime: boolean;
}

/**
 * Active workout log (S11) — the screen the client lives on for 45–90
 * minutes per session. Pre-seeded from the assignment on Start; sets
 * auto-save on input blur + on check. The rest timer starts itself
 * when a set is marked done; the Complete CTA sits sticky at the
 * bottom of the viewport so it's always thumb-reachable.
 *
 * Design parity (S11/S11b/S11c/S12/S14):
 *   - Done exercises collapse to one line ("4 of 4 sets done")
 *   - Current exercise expands, shows "Last time" hint + set rows
 *   - Per-set row: # / target string / kg input / reps input / check
 *   - Add-set CTA per exercise; remove via overflow
 *   - Add-exercise CTA at the bottom (freestyle + assigned-extra)
 *   - Sticky rest card (mobile) — auto-starts on check, ±10/skip
 *   - Sticky Complete bar with progress strip
 *
 * Decisions baked in (from the design's product calls):
 *   - Bodyweight: weight input hidden by default, +add reveal
 *   - Backgrounded > 30 min: timer dismissed, session shows "paused"
 *   - Complete with zero sets: confirm + offer skip
 */
@Component({
  selector: 'mh-workout-log-active',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    ConfirmDialog,
    InputTextModule,
    ListEmptyState,
    ProgressBar,
    Skeleton,
    Toast,
    TooltipModule,
    ExercisePickerDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './workout-log-active.html',
  styleUrl: './workout-log-active.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutLogActive implements OnInit, OnDestroy {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(WorkoutLogService);
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly completing = signal(false);

  /** Elapsed seconds since startedAt — updates every second. */
  readonly elapsedSeconds = signal(0);
  private _elapsedHandle: ReturnType<typeof setInterval> | null = null;

  /** Rest timer state — null when not resting. */
  readonly restSecondsLeft = signal<number | null>(null);
  readonly restNextSet = signal<LoggedSet | null>(null);
  readonly restNextExerciseName = signal<string>('');
  private _restHandle: ReturnType<typeof setInterval> | null = null;
  /** Wall-clock when the app last had focus (used for >30min auto-pause). */
  private _lastSeenAt: number = Date.now();

  /** Exercise picker dialog open + state (add-exercise + swap). */
  readonly pickerOpen = signal(false);
  /** Set when swapping (vs add-new). Null = add new exercise. */
  readonly swapTargetExerciseId = signal<string | null>(null);

  /** Last-time hints per logged-exercise id. */
  readonly lastTimeCache = signal<Map<string, LoggedSet[]>>(new Map());

  // ── Derived ──────────────────────────────────────────────────────

  readonly exercises = computed<LoggedExercise[]>(
    () => this.log()?.exercises ?? [],
  );

  readonly allSets = computed<LoggedSet[]>(() =>
    this.exercises().flatMap((e) => e.sets ?? []),
  );

  readonly totalSets = computed(() => this.allSets().length);
  readonly setsDone = computed(
    () => this.allSets().filter((s) => s.isCompleted).length,
  );
  readonly progressPercent = computed(() => {
    const t = this.totalSets();
    return t === 0 ? 0 : Math.round((this.setsDone() / t) * 100);
  });

  readonly isComplete = computed(
    () => this.log()?.status === WorkoutLogStatus.Completed,
  );

  readonly isFreestyle = computed(() => this.log()?.assignedWorkoutId == null);

  readonly elapsedLabel = computed(() => {
    const s = this.elapsedSeconds();
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  });

  readonly restLabel = computed(() => {
    const s = this.restSecondsLeft();
    if (s == null) return '';
    const m = Math.floor(Math.max(0, s) / 60);
    const ss = Math.max(0, s) % 60;
    return `${m}:${String(ss).padStart(2, '0')}`;
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/workouts']);
      return;
    }
    this.fetch(id);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  ngOnDestroy(): void {
    if (this._elapsedHandle) clearInterval(this._elapsedHandle);
    if (this._restHandle) clearInterval(this._restHandle);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  // ── Set logging (auto-save) ──────────────────────────────────────

  patchSet(
    ex: LoggedExercise,
    set: LoggedSet,
    patch: LogSetPayload,
  ): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._service.logSet(cur.id, set.id, patch).subscribe({
      next: (saved) => this._mergeSet(ex.id, saved),
      error: (err) => {
        showApiError(
          this._messageService,
          "Couldn't save set",
          'Please retry.',
          err,
        );
      },
    });
  }

  toggleComplete(ex: LoggedExercise, set: LoggedSet): void {
    if (this.isComplete()) return;
    const nextCompleted = !set.isCompleted;
    const patch: LogSetPayload = { isCompleted: nextCompleted };
    if (nextCompleted) {
      if (set.reps != null) patch.reps = set.reps;
      if (set.weightKg != null) patch.weightKg = set.weightKg;
    }
    this.patchSet(ex, set, patch);
    if (nextCompleted) this._startRest(ex, set);
    else this._stopRest();
  }

  onRepsBlur(ex: LoggedExercise, set: LoggedSet, raw: string): void {
    if (this.isComplete()) return;
    const v = raw.trim() === '' ? null : Number(raw);
    if (v === set.reps) return;
    this.patchSet(ex, set, v == null ? {} : { reps: v });
    set.reps = v;
  }

  onWeightBlur(ex: LoggedExercise, set: LoggedSet, raw: string): void {
    if (this.isComplete()) return;
    const v = raw.trim() === '' ? null : Number(raw);
    if (v === set.weightKg) return;
    this.patchSet(ex, set, v == null ? {} : { weightKg: v });
    set.weightKg = v;
  }

  // ── Add / remove sets + exercises ───────────────────────────────

  addSet(ex: LoggedExercise): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._service.addSet(cur.id, ex.id).subscribe({
      next: (saved) => {
        const next = (cur.exercises ?? []).map((e) =>
          e.id === ex.id ? { ...e, sets: [...(e.sets ?? []), saved] } : e,
        );
        this.log.set({ ...cur, exercises: next });
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't add set",
          'Please retry.',
          err,
        ),
    });
  }

  confirmRemoveExercise(ex: LoggedExercise): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._confirmationService.confirm({
      header: 'Skip this exercise?',
      message: `Remove "${ex.exerciseNameSnapshot}" and its sets from this session?`,
      icon: 'pi pi-times-circle',
      acceptLabel: 'Skip',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Keep',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._removeExercise(ex),
    });
  }

  openAddExercise(): void {
    this.swapTargetExerciseId.set(null);
    this.pickerOpen.set(true);
  }

  openSwapExercise(ex: LoggedExercise): void {
    this.swapTargetExerciseId.set(ex.id);
    this.pickerOpen.set(true);
  }

  /** ExercisePickerDialog in emitOnly mode hands us the chosen Exercise. */
  onExercisePicked(ex: Exercise): void {
    const cur = this.log();
    if (!cur) return;
    const swapTarget = this.swapTargetExerciseId();
    if (swapTarget) {
      this._service.removeExercise(cur.id, swapTarget).subscribe({
        next: () => this._appendExerciseFromPicker(ex.id),
        error: (err) =>
          showApiError(
            this._messageService,
            "Couldn't swap exercise",
            'Please retry.',
            err,
          ),
      });
    } else {
      this._appendExerciseFromPicker(ex.id);
    }
  }

  private _appendExerciseFromPicker(exerciseId: string): void {
    const cur = this.log();
    if (!cur) return;
    this._service.addExercise(cur.id, exerciseId).subscribe({
      next: (saved) => {
        const next = [
          ...(cur.exercises ?? []).filter(
            (e) => e.id !== this.swapTargetExerciseId(),
          ),
          { ...saved, sets: saved.sets ?? [] },
        ];
        this.log.set({ ...cur, exercises: next });
        this.pickerOpen.set(false);
        this.swapTargetExerciseId.set(null);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't add exercise",
          'Please retry.',
          err,
        ),
    });
  }

  // ── Complete ─────────────────────────────────────────────────────

  confirmComplete(): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    if (this.setsDone() === 0) {
      this._confirmationService.confirm({
        header: 'No sets logged',
        message:
          "You haven't logged any sets yet. Mark this workout as skipped instead, or keep going?",
        icon: 'pi pi-info-circle',
        acceptLabel: 'Mark as skipped',
        acceptButtonProps: { severity: 'secondary' },
        rejectLabel: 'Keep going',
        rejectButtonProps: { severity: 'secondary', text: true },
        accept: () => this._completeWorkout(/* allowEmpty */ true),
      });
      return;
    }
    const remaining = this.totalSets() - this.setsDone();
    const message =
      remaining > 0
        ? `You have ${remaining} unchecked ${remaining === 1 ? 'set' : 'sets'}. Complete anyway?`
        : 'Mark this workout as complete?';
    this._confirmationService.confirm({
      header: 'Complete workout?',
      message,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Complete',
      acceptButtonProps: { severity: 'success' },
      rejectLabel: 'Keep going',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._completeWorkout(false),
    });
  }

  private _completeWorkout(_allowEmpty: boolean): void {
    const cur = this.log();
    if (!cur) return;
    this.completing.set(true);
    this._stopRest();
    this._service.complete(cur.id).subscribe({
      next: () => {
        this.completing.set(false);
        this._router.navigate(['/user/workouts', cur.id, 'complete']);
      },
      error: (err) => {
        this.completing.set(false);
        showApiError(
          this._messageService,
          "Couldn't complete workout",
          'Please retry.',
          err,
        );
      },
    });
  }

  // ── Rest timer ───────────────────────────────────────────────────

  restPlus(): void {
    if (this.restSecondsLeft() == null) return;
    this.restSecondsLeft.update((s) => (s ?? 0) + 10);
  }

  restMinus(): void {
    if (this.restSecondsLeft() == null) return;
    const next = (this.restSecondsLeft() ?? 0) - 10;
    this.restSecondsLeft.set(Math.max(0, next));
  }

  restSkip(): void {
    this._stopRest();
  }

  // ── Template helpers ─────────────────────────────────────────────

  setTarget(s: LoggedSet): string {
    const a = s.assignedSet;
    if (!a) return '';
    const parts: string[] = [];
    if (a.targetRepsMin != null && a.targetRepsMax != null) {
      parts.push(
        a.targetRepsMin === a.targetRepsMax
          ? `${a.targetRepsMin}`
          : `${a.targetRepsMin}–${a.targetRepsMax}`,
      );
    } else if (a.targetRepsMin != null) {
      parts.push(`${a.targetRepsMin}+`);
    }
    const w = a.targetWeightKg ?? a.resolvedWeightKg;
    if (w != null) parts.push(`× ${w} kg`);
    else if (a.targetWeightPercent1rm != null)
      parts.push(`× ${a.targetWeightPercent1rm}% 1RM`);
    return parts.join(' ');
  }

  exerciseProgressLabel(ex: LoggedExercise): string {
    const sets = ex.sets ?? [];
    const done = sets.filter((s) => s.isCompleted).length;
    return `${done} of ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  }

  isExerciseDone(ex: LoggedExercise): boolean {
    const sets = ex.sets ?? [];
    return sets.length > 0 && sets.every((s) => s.isCompleted);
  }

  isCurrentExercise(ex: LoggedExercise): boolean {
    if (this.isExerciseDone(ex)) return false;
    const exs = this.exercises();
    const firstActiveIdx = exs.findIndex((e) => !this.isExerciseDone(e));
    return firstActiveIdx >= 0 && exs[firstActiveIdx].id === ex.id;
  }

  /** True for the first not-yet-completed set of the current exercise. */
  isCurrentSet(ex: LoggedExercise, set: LoggedSet): boolean {
    if (set.isCompleted || !this.isCurrentExercise(ex)) return false;
    const sets = ex.sets ?? [];
    const firstOpen = sets.find((x) => !x.isCompleted);
    return firstOpen?.id === set.id;
  }

  /** Lazy load the "Last time" hint when a card is the current one. */
  ensureLastTime(ex: LoggedExercise): void {
    if (!ex.exerciseId) return;
    const cache = this.lastTimeCache();
    if (cache.has(ex.id)) return;
    // Mark in-flight to avoid duplicate fetches.
    const next = new Map(cache);
    next.set(ex.id, []);
    this.lastTimeCache.set(next);
    this._service.lastForExercise(ex.exerciseId).subscribe({
      next: (sets) => {
        const map = new Map(this.lastTimeCache());
        map.set(ex.id, sets);
        this.lastTimeCache.set(map);
      },
      error: () => {
        // Silent — the hint is non-critical.
      },
    });
  }

  lastTimeFor(ex: LoggedExercise): LoggedSet[] {
    return this.lastTimeCache().get(ex.id) ?? [];
  }

  lastTimeSummary(ex: LoggedExercise): string {
    const sets = this.lastTimeFor(ex);
    if (sets.length === 0) return '';
    return sets
      .map((s) => {
        const r = s.reps ?? '?';
        const w = s.weightKg != null ? ` × ${s.weightKg}kg` : '';
        return `${r}${w}`;
      })
      .join(' · ');
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this._service.get(id).subscribe({
      next: (log) => {
        this.log.set(log);
        this.loading.set(false);
        this._startElapsed();
        // Auto-load last-time for the current exercise.
        const cur = (log.exercises ?? []).find(
          (e) =>
            !(e.sets ?? []).length ||
            !(e.sets ?? []).every((s) => s.isCompleted),
        );
        if (cur) this.ensureLastTime(cur);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load this workout",
          'It may have been removed or you may not have access.',
          err,
        );
        this._router.navigate(['/user/workouts']);
      },
    });
  }

  private _mergeSet(loggedExerciseId: string, saved: LoggedSet): void {
    const cur = this.log();
    if (!cur) return;
    const exercises = (cur.exercises ?? []).map((ex) =>
      ex.id === loggedExerciseId
        ? {
            ...ex,
            sets: (ex.sets ?? []).map((s) =>
              s.id === saved.id ? { ...s, ...saved } : s,
            ),
          }
        : ex,
    );
    this.log.set({ ...cur, exercises });
  }

  private _removeExercise(ex: LoggedExercise): void {
    const cur = this.log();
    if (!cur) return;
    this._service.removeExercise(cur.id, ex.id).subscribe({
      next: () => {
        const next = (cur.exercises ?? []).filter((e) => e.id !== ex.id);
        this.log.set({ ...cur, exercises: next });
        this._messageService.add({
          severity: 'success',
          summary: 'Exercise removed',
          life: 2000,
        });
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't remove exercise",
          'Please retry.',
          err,
        ),
    });
  }

  private _startElapsed(): void {
    const startedAt = this.log()?.startedAt;
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = (): void =>
      this.elapsedSeconds.set(
        Math.max(0, Math.floor((Date.now() - start) / 1000)),
      );
    tick();
    if (this._elapsedHandle) clearInterval(this._elapsedHandle);
    this._elapsedHandle = setInterval(tick, 1000);
  }

  private _startRest(ex: LoggedExercise, set: LoggedSet): void {
    const seconds = set.assignedSet?.restAfterSeconds ?? 90;
    this.restSecondsLeft.set(seconds);
    // Find the next not-completed set anywhere.
    const exs = this.exercises();
    let next: LoggedSet | null = null;
    let nextExName = '';
    outer: for (const e of exs) {
      for (const s of e.sets ?? []) {
        if (!s.isCompleted) {
          next = s;
          nextExName = e.exerciseNameSnapshot;
          break outer;
        }
      }
    }
    this.restNextSet.set(next);
    this.restNextExerciseName.set(nextExName);

    if (this._restHandle) clearInterval(this._restHandle);
    this._restHandle = setInterval(() => {
      const cur = this.restSecondsLeft();
      if (cur == null) return;
      const nx = cur - 1;
      if (nx <= 0) {
        this._stopRest();
      } else {
        this.restSecondsLeft.set(nx);
      }
    }, 1000);
  }

  private _stopRest(): void {
    if (this._restHandle) {
      clearInterval(this._restHandle);
      this._restHandle = null;
    }
    this.restSecondsLeft.set(null);
    this.restNextSet.set(null);
    this.restNextExerciseName.set('');
  }

  /**
   * Auto-pause: when the app comes back to the foreground after > 30
   * minutes, dismiss the rest timer (a 30-minute stale countdown is
   * meaningless). Locked decision §3.
   */
  private _onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      const away = Date.now() - this._lastSeenAt;
      if (away > 30 * 60 * 1000) {
        this._stopRest();
        this._messageService.add({
          severity: 'info',
          summary: 'Welcome back',
          detail:
            "You've been away a while — your rest timer was dismissed. Pick up where you left off.",
          life: 4000,
        });
      }
      this._lastSeenAt = Date.now();
    } else {
      this._lastSeenAt = Date.now();
    }
  };
}
