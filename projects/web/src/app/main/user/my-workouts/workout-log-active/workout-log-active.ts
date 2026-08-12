import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Card } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  Exercise,
  ExerciseService,
  LogSetPayload,
  LoggedExercise,
  LoggedSet,
  SetField,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  setFieldsFor,
  showApiError,
} from 'core';

import { ExercisePickerDialog } from '../../../instructor/programs/exercise-picker-dialog/exercise-picker-dialog';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

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
    NgTemplateOutlet,
    FormsModule,
    ButtonDirective,
    Card,
    ConfirmDialog,
    InputTextModule,
    ListEmptyState,
    ProgressBar,
    Skeleton,
    TableModule,
    Tag,
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
  readonly discarding = signal(false);

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
  /** Bodyweight exercises where the client asked for a weight field. */
  readonly weightRevealed = signal<Set<string>>(new Set());

  /** Last-time hints per logged-exercise id. */
  readonly lastTimeCache = signal<Map<string, LoggedSet[]>>(new Map());

  // ── Derived ──────────────────────────────────────────────────────

  readonly exercises = computed<LoggedExercise[]>(
    () => this.log()?.exercises ?? [],
  );

  /**
   * Sets that count toward progress. A skipped exercise leaves the
   * screen but leaves the denominator too, so "7 / 15" reflects what
   * you actually intend to do rather than what was prescribed.
   */
  readonly allSets = computed<LoggedSet[]>(() =>
    this.exercises()
      .filter((e) => !e.isSkipped)
      .flatMap((e) => e.sets ?? []),
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

  /**
   * Skip, with an undo instead of a confirm. Skipping is cheap and
   * reversible now that it flips a flag rather than deleting the row,
   * so a modal asking "are you sure" mid-set is friction for nothing.
   */
  skipExercise(ex: LoggedExercise): void {
    this._setSkipped(ex, true, () => {
      this._messageService.add({
        severity: 'info',
        summary: `Skipped ${ex.exerciseNameSnapshot}`,
        detail: 'It stays on your log, just not counted.',
        life: 6000,
        data: { undoExerciseId: ex.id },
      });
    });
  }

  undoSkip(ex: LoggedExercise): void {
    this._setSkipped(ex, false);
  }

  /**
   * Remove rather than skip when the plan never asked for this exercise
   * and nothing has been logged against it. You can't decline work
   * nobody set you, so tagging a mis-added freestyle exercise "Skipped"
   * would be the wrong verb and would clutter the coach's view.
   *
   * Once a set is logged it flips back to skip, because removing would
   * throw away work that actually happened.
   */
  canRemove(ex: LoggedExercise): boolean {
    if (ex.assignedExerciseId) return false;
    return !(ex.sets ?? []).some((s) => s.isCompleted);
  }

  confirmRemoveExercise(ex: LoggedExercise): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._confirmationService.confirm({
      header: 'Remove this exercise?',
      message: `"${ex.exerciseNameSnapshot}" and its empty sets come off this workout.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Remove',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Keep',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._removeExercise(ex),
    });
  }

  private _setSkipped(
    ex: LoggedExercise,
    skipped: boolean,
    onDone?: () => void,
  ): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._service.setExerciseSkipped(cur.id, ex.id, skipped).subscribe({
      next: (saved) => {
        this._mergeExercise(ex.id, { isSkipped: saved.isSkipped });
        onDone?.();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          skipped ? "Couldn't skip that" : "Couldn't undo the skip",
          'Please retry.',
          err,
        ),
    });
  }

  /** Patch one logged exercise in place, preserving its set rows. */
  private _mergeExercise(
    loggedExerciseId: string,
    patch: Partial<LoggedExercise>,
  ): void {
    const cur = this.log();
    if (!cur) return;
    this.log.set({
      ...cur,
      exercises: (cur.exercises ?? []).map((e) =>
        e.id === loggedExerciseId ? { ...e, ...patch } : e,
      ),
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
    if (!swapTarget) {
      this._appendExerciseFromPicker(ex.id);
      return;
    }

    // A real swap, not remove-then-add. The set rows and anything
    // already logged into them survive, and the substitution is
    // recorded so the coach sees what changed.
    this._service.swapExercise(cur.id, swapTarget, ex.id).subscribe({
      next: (saved) => {
        this._mergeExercise(swapTarget, {
          exerciseId: saved.exerciseId,
          exerciseNameSnapshot: saved.exerciseNameSnapshot,
          exerciseThumbnailUrlSnapshot: saved.exerciseThumbnailUrlSnapshot,
          swappedFromExerciseId: saved.swappedFromExerciseId,
          exercise: saved.exercise,
        });
        this.swapTargetExerciseId.set(null);
        this._messageService.add({
          severity: 'success',
          summary: `Swapped to ${saved.exerciseNameSnapshot}`,
          detail: 'Your logged sets carried over.',
          life: 3000,
        });
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't swap exercise",
          'Please retry.',
          err,
        ),
    });
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

  /**
   * "I changed my mind." Deliberately worded so nobody confuses it with
   * skipping: skipping records that you chose not to train, this
   * removes the workout entirely.
   */
  confirmDiscard(): void {
    const cur = this.log();
    if (!cur || this.isComplete()) return;
    this._confirmationService.confirm({
      header: 'Cancel this workout?',
      message:
        this.setsDone() > 0
          ? `This deletes the workout and the ${this.setsDone()} set${this.setsDone() === 1 ? '' : 's'} you logged. It won't show as skipped — it will be as if you never started.`
          : "This deletes the workout. It won't show as skipped — it will be as if you never started.",
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Cancel workout',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Keep going',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._discardWorkout(),
    });
  }

  private _discardWorkout(): void {
    const cur = this.log();
    if (!cur) return;
    this.discarding.set(true);
    this._stopRest();
    this._service.discard(cur.id).subscribe({
      next: () => {
        this.discarding.set(false);
        void this._router.navigate(['/user/training']);
      },
      error: (err) => {
        this.discarding.set(false);
        showApiError(
          this._messageService,
          "Couldn't cancel workout",
          'Please retry.',
          err,
        );
      },
    });
  }

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

  // ── Polymorphic set rows ─────────────────────────────────────────

  /**
   * Which input columns this exercise's rows show. A plank asks for a
   * time, a run asks for distance and time, a pull-up asks for reps
   * only. Driven by the catalog `kind`, so nothing has to be typed into
   * a field that makes no sense for the movement.
   */
  fieldsFor(ex: LoggedExercise): SetField[] {
    return setFieldsFor(ex.exercise?.kind);
  }

  showsField(ex: LoggedExercise, field: SetField): boolean {
    return this.fieldsFor(ex).includes(field);
  }

  /**
   * Bodyweight work hides weight until asked for, so weighted pull-ups
   * are possible without cluttering push-ups.
   */
  canRevealWeight(ex: LoggedExercise): boolean {
    return (
      ex.exercise?.kind === 'BODYWEIGHT' && !this.showsField(ex, 'weight')
    );
  }

  revealWeight(ex: LoggedExercise): void {
    this.weightRevealed.update((s) => new Set(s).add(ex.id));
  }

  isWeightVisible(ex: LoggedExercise): boolean {
    return this.showsField(ex, 'weight') || this.weightRevealed().has(ex.id);
  }

  /** Reps on split squats and single-arm work read as per-side. */
  repsSuffix(ex: LoggedExercise): string {
    return ex.exercise?.isUnilateral ? ' each' : '';
  }

  /** mm:ss for display; the API stores plain seconds. */
  secondsToClock(v: number | null): string {
    if (v == null) return '';
    const m = Math.floor(v / 60);
    const s = v % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Accepts "45", "0:45" or "1:05". Returns null on anything else. */
  clockToSeconds(raw: string): number | null {
    const t = raw.trim();
    if (t === '') return null;
    if (!t.includes(':')) {
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    }
    const [m, s] = t.split(':');
    const mm = Number(m);
    const ss = Number(s);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return Math.max(0, Math.round(mm * 60 + ss));
  }

  onDurationBlur(ex: LoggedExercise, set: LoggedSet, raw: string): void {
    if (this.isComplete()) return;
    const v = this.clockToSeconds(raw);
    if (v === set.durationSeconds) return;
    this.patchSet(ex, set, v == null ? {} : { durationSeconds: v });
    set.durationSeconds = v;
  }

  /** Distance is entered in km and stored in metres (locked unit rule). */
  onDistanceBlur(ex: LoggedExercise, set: LoggedSet, raw: string): void {
    if (this.isComplete()) return;
    const t = raw.trim();
    const km = t === '' ? null : Number(t);
    const v =
      km == null || !Number.isFinite(km) || km < 0
        ? null
        : Math.round(km * 1000);
    if (v === set.distanceMeters) return;
    this.patchSet(ex, set, v == null ? {} : { distanceMeters: v });
    set.distanceMeters = v;
  }

  distanceKm(set: LoggedSet): string {
    return set.distanceMeters == null
      ? ''
      : String(Math.round(set.distanceMeters / 10) / 100);
  }

  /** Derived, never typed: pace only means something with both halves. */
  paceLabel(set: LoggedSet): string {
    const m = set.distanceMeters;
    const s = set.durationSeconds;
    if (!m || !s || m <= 0) return '';
    const secPerKm = Math.round(s / (m / 1000));
    return `${this.secondsToClock(secPerKm)} /km`;
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
    if (ex.isSkipped || this.isExerciseDone(ex)) return false;
    const exs = this.exercises();
    // Skipped exercises are passed over when working out what's next.
    const firstActiveIdx = exs.findIndex(
      (e) => !e.isSkipped && !this.isExerciseDone(e),
    );
    return firstActiveIdx >= 0 && exs[firstActiveIdx].id === ex.id;
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
