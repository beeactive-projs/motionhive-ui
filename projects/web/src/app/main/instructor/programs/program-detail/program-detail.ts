import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  PrescribedSet,
  Program,
  ProgramService,
  ProgramStatus,
  ProgramWorkout,
  showApiError,
} from 'core';

import { AssignProgramDialog } from '../assign-program-dialog/assign-program-dialog';

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
    RouterLink,
    TitleCasePipe,
    ButtonModule,
    Toast,
    TooltipModule,
    AssignProgramDialog,
  ],
  providers: [MessageService],
  templateUrl: './program-detail.html',
  styleUrl: './program-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramDetail {
  /** Bound from the route param via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  readonly program = signal<Program | null>(null);
  readonly loading = signal(false);
  readonly assignDialogOpen = signal(false);
  private _loadedId: string | null = null;

  // Group workouts by week for rendering.
  readonly weeks = computed<{ week: number; workouts: ProgramWorkout[] }[]>(
    () => {
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
    },
  );

  readonly totalWorkouts = computed(
    () => this.program()?.workouts?.length ?? 0,
  );

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

  constructor() {
    // Lazy-load on id change. `input.required<string>()` runs in the
    // injection context so accessing `id()` inside a computed/effect
    // re-runs on route change.
    queueMicrotask(() => {
      const cur = this.id();
      if (cur && cur !== this._loadedId) this.fetch(cur);
    });
  }

  // ── Stub actions (wired in FE-P2/P3) ─────────────────────────────

  editStub(): void {
    this._messageService.add({
      severity: 'info',
      summary: 'Coming next',
      detail: 'Inline editing lands in FE-P2 (program builder).',
      life: 3500,
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

  deleteStub(): void {
    this._messageService.add({
      severity: 'info',
      summary: 'Coming next',
      detail: 'Delete flow lands in FE-P2 alongside the builder.',
      life: 3500,
    });
  }

  // ── Helpers for the template ─────────────────────────────────────

  statusTone(s: ProgramStatus): 'draft' | 'published' | 'archived' {
    switch (s) {
      case ProgramStatus.Published:
        return 'published';
      case ProgramStatus.Archived:
        return 'archived';
      default:
        return 'draft';
    }
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
    else if (s.targetWeightPercent1rm != null)
      parts.push(`${s.targetWeightPercent1rm}% 1RM`);
    if (s.targetDurationSeconds != null)
      parts.push(`${s.targetDurationSeconds}s`);
    if (s.targetDistanceMeters != null)
      parts.push(`${s.targetDistanceMeters}m`);
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
        this._loadedId = id;
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
