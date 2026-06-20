import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ProgressBar } from 'primeng/progressbar';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  TagSeverity,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  showApiError,
} from 'core';
import { TimeRow } from '../../../../_shared/components/time-row/time-row';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

interface WeekGroup {
  week: number;
  current: boolean;
  workouts: AssignedWorkout[];
}

type WorkoutState = 'todo' | 'doing' | 'done' | 'skip';
type WorkoutCta = 'start' | 'resume' | 'view' | 'none';

/**
 * Client plan detail (S10).
 *
 * Hero card with progress, then week-grouped schedule (p-accordion).
 * Each workout is a shared `mh-time-row`: calendar-block date, name +
 * volume, status tag, and a state-driven CTA (Start / Resume / View).
 *
 * Per the locked V1 decisions: dates are guidance not gates (anything
 * not-started can be started early); auto-skip happens BE-side when
 * a scheduled date passes with no log; paused plans hide the Start
 * CTA until the coach resumes.
 */
@Component({
  selector: 'mh-client-plan-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    HexAvatar,
    ButtonModule,
    Card,
    ConfirmDialog,
    ListEmptyState,
    ProgressBar,
    Skeleton,
    Tag,
    TimeRow,
    Toast,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-plan-detail.html',
  styleUrl: './client-plan-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPlanDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(ProgramAssignmentService);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  // Enum exposed for template comparisons — never compare against raw
  // string literals (see CLAUDE.md).
  protected readonly Status = ProgramAssignmentStatus;

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly loading = signal(false);
  readonly starting = signal<string | null>(null);
  /** Week indexes whose accordion panel is open. */
  readonly openWeeks = signal<number[]>([]);

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

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/plans']);
      return;
    }
    this.fetch(id);
  }

  // ── Actions ──────────────────────────────────────────────────────

  startWorkout(w: AssignedWorkout): void {
    if (this.starting() === w.id) return;
    // Paused plan → no Start (coach must resume first).
    if (this.assignment()?.status === ProgramAssignmentStatus.Paused) {
      this._messageService.add({
        severity: 'info',
        summary: 'Plan paused',
        detail: 'Your coach has paused this plan. Ask them to resume it to continue.',
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
        showApiError(this._messageService, "Couldn't start workout", 'Please retry.', err);
      },
    });
  }

  viewWorkout(w: AssignedWorkout): void {
    // Skipped workouts never produced a log — tell the user politely
    // rather than firing a doomed BE lookup.
    if (w.status === WorkoutLogStatus.Skipped) {
      this._messageService.add({
        severity: 'info',
        summary: 'Nothing to replay',
        detail: `"${w.name}" was skipped — no session was logged.`,
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
          "Couldn't open the workout",
          'Try again in a moment, or open the workout from /user/workouts.',
          err,
        ),
    });
  }

  confirmSkip(w: AssignedWorkout): void {
    const state = this.deriveState(w);
    if (state === 'done' || state === 'skip') return;
    this._confirmationService.confirm({
      header: 'Skip workout?',
      message: `Skip "${w.name}"? You can still come back to it later if you change your mind, but it won't count toward your weekly goal.`,
      icon: 'pi pi-forward',
      acceptLabel: 'Skip workout',
      acceptButtonProps: { severity: 'secondary' },
      rejectLabel: 'Cancel',
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
          summary: 'Workout skipped',
          life: 2000,
        });
      },
      error: (err) => {
        showApiError(this._messageService, "Couldn't skip workout", 'Please retry.', err);
      },
    });
  }

  // ── Template helpers ─────────────────────────────────────────────

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

  /** Left-edge tone for the workout's `mh-time-row`. */
  workoutTone(w: AssignedWorkout): 'honey' | 'teal' | 'muted' | 'none' {
    switch (this.deriveState(w)) {
      case 'doing':
        return 'honey';
      case 'done':
        return 'teal';
      case 'skip':
        return 'muted';
      default:
        return 'none';
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
        return 'Completed';
      case 'doing':
        return 'In progress';
      case 'skip':
        return 'Skipped';
      default:
        return 'Not started';
    }
  }

  workoutVolume(w: AssignedWorkout): string {
    const exCount = w.exercises?.length ?? 0;
    const setCount = (w.exercises ?? []).reduce((n, e) => n + (e.sets?.length ?? 0), 0);
    const parts: string[] = [];
    parts.push(`${exCount} ${exCount === 1 ? 'exercise' : 'exercises'}`);
    parts.push(`${setCount} ${setCount === 1 ? 'set' : 'sets'}`);
    if (w.estimatedDurationMinutes) {
      parts.push(`~${w.estimatedDurationMinutes} min`);
    }
    return parts.join(' · ');
  }

  // ── Plan status (hero tag) ───────────────────────────────────────

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
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  instructorInitials(): string {
    const i = this.assignment()?.instructor;
    if (!i) return '?';
    return `${i.firstName?.[0] ?? ''}${i.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  }

  instructorName(): string {
    const i = this.assignment()?.instructor;
    if (!i) return 'your coach';
    return `${i.firstName} ${i.lastName}`.trim() || 'your coach';
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
          "Couldn't load your plan",
          'It may have been removed or you may not have access.',
          err,
        );
        this._router.navigate(['/user/plans']);
      },
    });
  }
}
