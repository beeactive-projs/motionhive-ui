import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  AssignedSet,
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  showApiError,
} from 'core';

/**
 * Client-side detail view of an assignment — the deep-copied program
 * tree (workouts → exercises → sets) with each workout's scheduled
 * date. Read-only for now; "Start workout" lands in the next slice
 * once the logging UI is in place.
 */
@Component({
  selector: 'mh-my-plan-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TitleCasePipe,
    ButtonModule,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './my-plan-detail.html',
  styleUrl: './my-plan-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPlanDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);

  readonly assignment = signal<ProgramAssignment | null>(null);
  readonly loading = signal(false);

  // ── Derived ──────────────────────────────────────────────────────

  readonly workouts = computed<AssignedWorkout[]>(
    () => this.assignment()?.workouts ?? [],
  );

  readonly weeks = computed<{ week: number; workouts: AssignedWorkout[] }[]>(
    () => {
      const map = new Map<number, AssignedWorkout[]>();
      for (const w of this.workouts()) {
        const arr = map.get(w.weekIndex) ?? [];
        arr.push(w);
        map.set(w.weekIndex, arr);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, ws]) => ({
          week,
          workouts: ws.sort((a, b) => a.dayIndex - b.dayIndex),
        }));
    },
  );

  readonly totalWorkouts = computed(() => this.workouts().length);
  readonly completedWorkouts = computed(
    () =>
      this.workouts().filter(
        (w) => w.status === 'COMPLETED' || w.status === 'SKIPPED',
      ).length,
  );

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/my/plans']);
      return;
    }
    this.fetch(id);
  }

  // ── Template helpers ─────────────────────────────────────────────

  statusTone(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'active';
      case ProgramAssignmentStatus.Completed:
        return 'completed';
      case ProgramAssignmentStatus.Paused:
        return 'paused';
      case ProgramAssignmentStatus.Cancelled:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  workoutStatusTone(w: AssignedWorkout): string {
    if (w.status === 'COMPLETED') return 'done';
    if (w.status === 'SKIPPED') return 'skipped';
    if (w.status === 'IN_PROGRESS') return 'progress';
    return 'todo';
  }

  workoutStatusLabel(w: AssignedWorkout): string {
    if (w.status === 'COMPLETED') return 'Completed';
    if (w.status === 'SKIPPED') return 'Skipped';
    if (w.status === 'IN_PROGRESS') return 'In progress';
    return 'Not started';
  }

  setSummary(s: AssignedSet): string {
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
    else if (s.targetWeightPercent1rm != null)
      parts.push(`${s.targetWeightPercent1rm}% 1RM`);
    if (s.targetDurationSeconds != null) parts.push(`${s.targetDurationSeconds}s`);
    if (s.targetDistanceMeters != null) parts.push(`${s.targetDistanceMeters}m`);
    if (s.targetRpe != null) parts.push(`RPE ${s.targetRpe}`);
    if (s.targetRir != null) parts.push(`${s.targetRir} RIR`);
    return parts.length ? parts.join(' · ') : '—';
  }

  instructorName(a: ProgramAssignment): string {
    const i = a.instructor;
    if (!i) return 'your instructor';
    return `${i.firstName} ${i.lastName}`.trim() || 'your instructor';
  }

  startWorkoutStub(w: AssignedWorkout): void {
    this._messageService.add({
      severity: 'info',
      summary: 'Logging UI ships next',
      detail: `"${w.name}" — interactive logging lands in the next slice.`,
      life: 3500,
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this._service.get(id).subscribe({
      next: (a) => {
        this.assignment.set(a);
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
        this._router.navigate(['/my/plans']);
      },
    });
  }
}
