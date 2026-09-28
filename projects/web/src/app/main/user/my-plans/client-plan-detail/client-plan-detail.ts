import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Divider } from 'primeng/divider';
import { Message } from 'primeng/message';
import { ProgressBar } from 'primeng/progressbar';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  AssignedExercise,
  AssignedSet,
  AssignedWorkout,
  EnumLabelPipe,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  TagSeverity,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  appLocale,
  enumLabel,
  escapeHtml,
  showApiError,
} from 'core';
import { ExerciseDetailDialog } from '../../../instructor/exercises/exercise-detail-dialog/exercise-detail-dialog';
import { KpiCard } from '../../../../_shared/components/kpi-card/kpi-card';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

interface WeekGroup {
  week: number;
  current: boolean;
  workouts: AssignedWorkout[];
}

type WorkoutState = 'todo' | 'doing' | 'done' | 'skip';
type WorkoutCta = 'start' | 'resume' | 'view' | 'none';

interface PlanCta {
  label: string;
  icon: string;
  disabled: boolean;
  kind: 'start' | 'resume' | 'review' | 'paused' | 'cancelled' | 'none';
}

/**
 * Client plan detail (S10).
 *
 * Follows the `session-showcase` two-column layout — back-button header, a
 * KPI strip, a wide details column (facts + notes + week-grouped schedule)
 * and a sidebar CTA card — enriched with `workout-log-replay` patterns
 * (exercise cards + set tables). The schedule now shows each workout's
 * prescription (exercises → target sets), since the detail endpoint ships
 * the full tree.
 *
 * Per the locked V1 decisions: dates are guidance not gates (anything
 * not-started can be started early); auto-skip happens BE-side when
 * a scheduled date passes with no log; paused plans hide the Start
 * CTA until the coach resumes.
 */
@Component({
  selector: 'mh-client-plan-detail',
  imports: [
    DatePipe,
    EnumLabelPipe,
    TranslatePipe,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    HexAvatar,
    ButtonDirective,
    Card,
    ConfirmDialog,
    Divider,
    ExerciseDetailDialog,
    KpiCard,
    ListEmptyState,
    Message,
    ProgressBar,
    Skeleton,
    TableModule,
    Tag,
    Toast,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-plan-detail.html',
  styleUrl: './client-plan-detail.scss',
})
export class ClientPlanDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _service = inject(ProgramAssignmentService);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

  /** Weights, percentages and metres — locale decimals, no grouping (as before). */
  private readonly _numberFormat = new Intl.NumberFormat(appLocale(), {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  /** Kilometres, always two decimals (was `toFixed(2)`). */
  private readonly _kmFormat = new Intl.NumberFormat(appLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });

  // Enum exposed for template comparisons — never compare against raw
  // string literals (see CLAUDE.md).
  protected readonly Status = ProgramAssignmentStatus;

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly loading = signal(false);
  readonly starting = signal<string | null>(null);
  readonly viewingExerciseId = signal<string | null>(null);
  readonly viewOpen = signal(false);
  openExerciseInfo(id: string | null | undefined): void {
    if (!id) return;
    this.viewingExerciseId.set(id);
    this.viewOpen.set(true);
  }
  /** Week indexes whose accordion panel is open. */
  readonly openWeeks = signal<number[]>([]);
  /** Assigned-workout ids whose prescription preview is expanded. */
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  // ── Derived ──────────────────────────────────────────────────────

  readonly workouts = computed<AssignedWorkout[]>(() => this.assignment()?.workouts ?? []);

  readonly completedCount = computed(
    () => this.workouts().filter((w) => w.status === WorkoutLogStatus.Completed).length,
  );

  /**
   * "Current" week = the one containing the next not-started or in-progress
   * workout. Falls back to the lowest-index week.
   */
  readonly currentWeekIndex = computed<number | null>(() => {
    const ws = this.workouts();
    if (ws.length === 0) return null;
    const next = ws.find(
      (w) => w.status !== WorkoutLogStatus.Completed && w.status !== WorkoutLogStatus.Skipped,
    );
    return next?.weekIndex ?? ws[0].weekIndex;
  });

  readonly weeks = computed<WeekGroup[]>(() => {
    const map = new Map<number, AssignedWorkout[]>();
    for (const w of this.workouts()) {
      const arr = map.get(w.weekIndex) ?? [];
      arr.push(w);
      map.set(w.weekIndex, arr);
    }
    const current = this.currentWeekIndex();
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, ws]) => ({
        week,
        current: week === current,
        workouts: ws.sort((a, b) => a.dayIndex - b.dayIndex),
      }));
  });

  /** Distinct weeks — the "Weeks" KPI. */
  readonly weekCount = computed(() => this.weeks().length);

  /**
   * The workout the primary CTA acts on: a resumable in-progress one wins,
   * else the next not-started one (week/day order).
   */
  readonly nextWorkout = computed<AssignedWorkout | null>(() => {
    const ws = [...this.workouts()].sort(
      (a, b) => a.weekIndex - b.weekIndex || a.dayIndex - b.dayIndex,
    );
    return (
      ws.find((w) => w.status === WorkoutLogStatus.InProgress) ??
      ws.find((w) => w.status == null) ??
      null
    );
  });

  /** Sidebar primary CTA — adapts to plan status + the next workout. */
  readonly primaryCta = computed<PlanCta | null>(() => {
    const s = this.assignment()?.status;
    if (!s) return null;
    const label = (key: string): string =>
      this._translateService.instant(`training.planDetail.cta.${key}`);
    if (s === ProgramAssignmentStatus.Paused) {
      return { label: label('paused'), icon: 'pi pi-pause', disabled: true, kind: 'paused' };
    }
    if (s === ProgramAssignmentStatus.Cancelled) {
      return {
        label: label('cancelled'),
        icon: 'pi pi-times-circle',
        disabled: true,
        kind: 'cancelled',
      };
    }
    if (s === ProgramAssignmentStatus.Completed) {
      return { label: label('review'), icon: 'pi pi-eye', disabled: false, kind: 'review' };
    }
    const next = this.nextWorkout();
    if (!next) {
      return { label: label('allDone'), icon: 'pi pi-check', disabled: true, kind: 'none' };
    }
    if (next.status === WorkoutLogStatus.InProgress) {
      return { label: label('resume'), icon: 'pi pi-play', disabled: false, kind: 'resume' };
    }
    return { label: label('startNext'), icon: 'pi pi-play', disabled: false, kind: 'start' };
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/plans']);
      return;
    }
    this.fetch(id);
  }

  // ── Navigation ───────────────────────────────────────────────────

  /** Back to wherever we came from; fall back to the plans list. */
  goBack(): void {
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/user/plans']);
    }
  }

  // ── Prescription preview toggle ──────────────────────────────────

  isExpanded(w: AssignedWorkout): boolean {
    return this.expanded().has(w.id);
  }

  toggleExpanded(w: AssignedWorkout): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(w.id)) next.delete(w.id);
      else next.add(w.id);
      return next;
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  /** Sidebar CTA — routes to the right workout based on plan/next state. */
  runPrimary(): void {
    const cta = this.primaryCta();
    if (!cta || cta.disabled) return;
    if (cta.kind === 'review') {
      const last = [...this.workouts()]
        .reverse()
        .find((w) => w.status === WorkoutLogStatus.Completed);
      if (last) this.viewWorkout(last);
      return;
    }
    const next = this.nextWorkout();
    if (next) this.startWorkout(next);
  }

  startWorkout(w: AssignedWorkout): void {
    if (this.starting() === w.id) return;
    // Paused plan → no Start (coach must resume first).
    if (this.assignment()?.status === ProgramAssignmentStatus.Paused) {
      this._messageService.add({
        severity: 'info',
        summary: this._translateService.instant('training.planDetail.toast.paused.summary'),
        detail: this._translateService.instant('training.planDetail.toast.paused.detail'),
        life: 3500,
      });
      return;
    }

    this.starting.set(w.id);
    this._logService.start({ assignedWorkoutId: w.id }).subscribe({
      next: (log) => {
        this.starting.set(null);
        this._router.navigate(['/user/workout-log', log.id]);
      },
      error: (err) => {
        this.starting.set(null);
        showApiError(
          this._messageService,
          this._translateService.instant('training.planDetail.toast.startFailed'),
          this._translateService.instant('training.planDetail.toast.pleaseRetry'),
          err,
        );
      },
    });
  }

  viewWorkout(w: AssignedWorkout): void {
    // Skipped workouts never produced a log — tell the user politely
    // rather than firing a doomed BE lookup.
    if (w.status === WorkoutLogStatus.Skipped) {
      this._messageService.add({
        severity: 'info',
        summary: this._translateService.instant('training.planDetail.toast.nothingToReplay.summary'),
        detail: this._translateService.instant('training.planDetail.toast.nothingToReplay.detail', {
          name: w.name,
        }),
        life: 3000,
      });
      return;
    }
    this._logService.getByAssignedWorkout(w.id).subscribe({
      next: (log: WorkoutLog) =>
        this._router.navigate(['/user/workout-log', log.id, 'replay']),
      error: (err: unknown) =>
        showApiError(
          this._messageService,
          this._translateService.instant('training.planDetail.toast.openFailed.summary'),
          this._translateService.instant('training.planDetail.toast.openFailed.detail'),
          err,
        ),
    });
  }

  confirmSkip(w: AssignedWorkout): void {
    const state = this.deriveState(w);
    if (state === 'done' || state === 'skip') return;
    this._confirmationService.confirm({
      header: this._translateService.instant('training.planDetail.confirm.skip.header'),
      message: this._translateService.instant('training.planDetail.confirm.skip.message', {
        name: escapeHtml(w.name),
      }),
      icon: 'pi pi-forward',
      acceptLabel: this._translateService.instant('training.planDetail.skipWorkout'),
      acceptButtonProps: { severity: 'secondary' },
      rejectLabel: this._translateService.instant('button.cancel'),
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._skipWorkout(w),
    });
  }

  private _skipWorkout(w: AssignedWorkout): void {
    this._service.skipAssignedWorkout(w.id).subscribe({
      next: () => {
        // Optimistically flip the workout state + bump completion%.
        const a = this.assignment();
        if (!a) return;
        const workouts = (a.workouts ?? []).map((aw) =>
          aw.id === w.id ? { ...aw, status: WorkoutLogStatus.Skipped } : aw,
        );
        const done = workouts.filter(
          (aw) =>
            aw.status === WorkoutLogStatus.Completed || aw.status === WorkoutLogStatus.Skipped,
        ).length;
        const percent = workouts.length === 0 ? 0 : Math.round((done / workouts.length) * 100);
        this.assignment.set({ ...a, workouts, completionPercent: percent });
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('training.planDetail.toast.skipped'),
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(
          this._messageService,
          this._translateService.instant('training.planDetail.toast.skipFailed'),
          this._translateService.instant('training.planDetail.toast.pleaseRetry'),
          err,
        );
      },
    });
  }

  // ── Workout template helpers ─────────────────────────────────────

  deriveState(w: AssignedWorkout): WorkoutState {
    if (w.status === WorkoutLogStatus.Completed) return 'done';
    if (w.status === WorkoutLogStatus.Skipped) return 'skip';
    if (w.status === WorkoutLogStatus.InProgress) return 'doing';
    return 'todo';
  }

  workoutCta(w: AssignedWorkout): WorkoutCta {
    switch (this.deriveState(w)) {
      case 'done':
      case 'skip':
        return 'view';
      case 'doing':
        return 'resume';
      default:
        return 'start';
    }
  }

  /** Status tag severity — neutral/semantic only (no honey/amber for status). */
  workoutSeverity(w: AssignedWorkout): TagSeverity {
    switch (this.deriveState(w)) {
      case 'done':
        return TagSeverity.Success;
      case 'doing':
        return TagSeverity.Info;
      default:
        return TagSeverity.Secondary;
    }
  }

  workoutTagIcon(w: AssignedWorkout): string {
    switch (this.deriveState(w)) {
      case 'done':
        return 'pi pi-check';
      case 'doing':
        return 'pi pi-bolt';
      case 'skip':
        return 'pi pi-minus-circle';
      default:
        return 'pi pi-circle';
    }
  }

  workoutTagLabel(w: AssignedWorkout): string {
    switch (this.deriveState(w)) {
      case 'done':
        return enumLabel('workoutLogStatus', WorkoutLogStatus.Completed);
      case 'doing':
        return enumLabel('workoutLogStatus', WorkoutLogStatus.InProgress);
      case 'skip':
        return enumLabel('workoutLogStatus', WorkoutLogStatus.Skipped);
      default:
        return this._translateService.instant('training.planDetail.notStarted');
    }
  }

  workoutVolume(w: AssignedWorkout): string {
    const exCount = w.exercises?.length ?? 0;
    const setCount = (w.exercises ?? []).reduce((n, e) => n + (e.sets?.length ?? 0), 0);
    const parts: string[] = [];
    parts.push(this._translateService.instant('count.exercises', { count: exCount }));
    parts.push(this._translateService.instant('count.sets', { count: setCount }));
    if (w.estimatedDurationMinutes) {
      parts.push(
        this._translateService.instant('training.planDetail.approxMinutes', {
          minutes: w.estimatedDurationMinutes,
        }),
      );
    }
    return parts.join(' · ');
  }

  // ── Prescription (target) formatting ─────────────────────────────

  exerciseSetCount(ex: AssignedExercise): number {
    return ex.sets?.length ?? 0;
  }

  /**
   * Pretty-print a set's *prescribed targets* (sibling of the replay's
   * `setActualLabel`, which prints logged results):
   *   strength → "10–15 reps · 80 kg @ RPE 8"
   *   cardio   → "30 min" / "5 km"
   *   nothing  → "—"
   */
  setTargetLabel(s: AssignedSet): string {
    const t = (key: string, params: Record<string, unknown>): string =>
      this._translateService.instant(`training.planDetail.target.${key}`, params);
    const num = (v: number): string => this._numberFormat.format(v);
    const parts: string[] = [];
    if (s.targetRepsMin != null && s.targetRepsMax != null) {
      parts.push(
        s.targetRepsMin === s.targetRepsMax
          ? t('reps', { count: s.targetRepsMin })
          : t('repsRange', { min: s.targetRepsMin, max: s.targetRepsMax }),
      );
    } else if (s.targetRepsMin != null) {
      parts.push(t('repsMin', { min: s.targetRepsMin }));
    }
    if (s.targetWeightKg != null) {
      parts.push(t('weightKg', { weight: num(s.targetWeightKg) }));
    } else if (s.targetWeightPercent1rm != null) {
      parts.push(t('percent1rm', { percent: num(s.targetWeightPercent1rm) }));
    }
    if (s.targetDurationSeconds != null) {
      const m = Math.round(s.targetDurationSeconds / 60);
      parts.push(
        m > 0
          ? this._translateService.instant('time.minutesShort', { minutes: m })
          : t('seconds', { seconds: s.targetDurationSeconds }),
      );
    }
    if (s.targetDistanceMeters != null) {
      parts.push(
        s.targetDistanceMeters >= 1000
          ? t('km', { distance: this._kmFormat.format(s.targetDistanceMeters / 1000) })
          : t('meters', { distance: num(s.targetDistanceMeters) }),
      );
    }
    let label = parts.join(' · ') || '—';
    if (s.targetRpe != null) label += ` ${t('rpe', { value: num(s.targetRpe) })}`;
    else if (s.targetRir != null) label += ` ${t('rir', { value: num(s.targetRir) })}`;
    return label;
  }

  /** Rest after a set, e.g. "75s" or "1m 30s". */
  restLabel(s: AssignedSet): string {
    const r = s.restAfterSeconds;
    if (r == null) return '—';
    if (r < 60) return this._translateService.instant('time.secondsShort', { seconds: r });
    const m = Math.floor(r / 60);
    const sec = r % 60;
    return sec
      ? this._translateService.instant('training.common.rest.minutesSeconds', {
          minutes: m,
          seconds: sec,
        })
      : this._translateService.instant('time.totalMinutes', { minutes: m });
  }

  // ── Plan-level helpers (hero/sidebar) ────────────────────────────

  planSeverity(s: ProgramAssignmentStatus): TagSeverity {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return TagSeverity.Info;
      case ProgramAssignmentStatus.Completed:
        return TagSeverity.Success;
      case ProgramAssignmentStatus.Cancelled:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  planIcon(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'pi pi-bolt';
      case ProgramAssignmentStatus.Completed:
        return 'pi pi-check-circle';
      case ProgramAssignmentStatus.Paused:
        return 'pi pi-pause';
      case ProgramAssignmentStatus.Cancelled:
        return 'pi pi-times-circle';
      default:
        return 'pi pi-clock';
    }
  }

  planLabel(s: ProgramAssignmentStatus): string {
    return enumLabel('programAssignmentStatus', s);
  }

  /** Sidebar status banner severity — mirrors showcase's booking messages. */
  planMessageSeverity(s: ProgramAssignmentStatus): 'success' | 'info' | 'warn' | 'secondary' {
    switch (s) {
      case ProgramAssignmentStatus.Completed:
        return 'success';
      case ProgramAssignmentStatus.Active:
        return 'info';
      case ProgramAssignmentStatus.Paused:
        return 'warn';
      default:
        return 'secondary';
    }
  }

  instructorName(): string {
    const i = this.assignment()?.instructor;
    const name = i ? `${i.firstName} ${i.lastName}`.trim() : '';
    return name || this._translateService.instant('training.common.yourCoach');
  }

  isPaused(): boolean {
    return this.assignment()?.status === ProgramAssignmentStatus.Paused;
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this._service.get(id).subscribe({
      next: (a) => {
        this.assignment.set(a);
        const current = this.currentWeekIndex();
        this.openWeeks.set(current != null ? [current] : []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('training.planDetail.toast.loadFailed.summary'),
          this._translateService.instant('error.mayBeRemoved'),
          err,
        );
        this._router.navigate(['/user/plans']);
      },
    });
  }
}
