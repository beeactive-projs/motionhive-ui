import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';

import { Routine, RoutineExercise, RoutineService, showApiError } from 'core';

import { ExerciseDetailDialog } from '../../../instructor/exercises/exercise-detail-dialog/exercise-detail-dialog';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { RoutineFormDialog } from '../_dialogs/routine-form-dialog/routine-form-dialog';

/** Read-only view of a routine's contents, before starting it. */
@Component({
  selector: 'mh-routine-detail',
  standalone: true,
  imports: [
    ButtonDirective,
    Card,
    ExerciseDetailDialog,
    ListEmptyState,
    RoutineFormDialog,
    Skeleton,
    Tag,
    Toast,
  ],
  templateUrl: './routine-detail.html',
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutineDetail {
  private readonly _service = inject(RoutineService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  readonly routine = signal<Routine | null>(null);
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly editOpen = signal(false);
  // Exercise-detail dialog for "what's this movement?" — read-only.
  readonly viewingExerciseId = signal<string | null>(null);
  readonly viewOpen = signal(false);

  openExerciseInfo(id: string | null | undefined): void {
    if (!id) return;
    this.viewingExerciseId.set(id);
    this.viewOpen.set(true);
  }

  /** MotionHive's own: runnable and copyable, never editable in place. */
  readonly isSystem = computed(() => this.routine()?.source === 'SYSTEM');

  readonly exercises = computed(() => this.routine()?.exercises ?? []);

  readonly totalSets = computed(() =>
    this.exercises().reduce((n, e) => n + (e.sets?.length ?? e.defaultSets ?? 0), 0),
  );

  constructor() {
    // Follows the param, not a snapshot: saving a copy navigates to the
    // copy and Angular reuses this component, so a snapshot would leave
    // the original on screen under the new id.
    this._route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.loading.set(true);
          this.routine.set(null);
          if (!id) return of(null);
          // Caught here, not on the outer subscribe: an error there
          // would end the param stream and the next id would never load.
          return this._service.get(id).pipe(
            catchError((err: HttpErrorResponse) => {
              // 404 has its own panel; anything else is worth surfacing.
              if (err.status !== 404) {
                showApiError(
                  this._messageService,
                  "Couldn't load this routine",
                  'Please try again.',
                  err,
                );
              }
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((r) => {
        this.routine.set(r);
        this.loading.set(false);
      });
  }

  /** "3 × 8-12" for reps, "3 × 30s" for holds, "3 sets" when neither is set. */
  setSummary(e: RoutineExercise): string {
    const count = e.sets?.length ?? e.defaultSets ?? 0;
    // Summarising from set 1 would claim all three are 12 × 20 kg.
    if (this._isVaried(e)) return `${count} sets`;
    const min = e.targetRepsMin ?? e.sets?.[0]?.targetRepsMin ?? null;
    const max = e.targetRepsMax ?? e.sets?.[0]?.targetRepsMax ?? null;
    if (min != null || max != null) {
      return `${count} × ${this._repRange(min, max)}`;
    }
    // Planks and carries prescribe a hold, so reps are empty by design.
    const seconds = e.sets?.[0]?.targetDurationSeconds ?? null;
    if (seconds != null) return `${count} × ${this._duration(seconds)}`;
    return `${count} sets`;
  }

  /** Per-set rows, only when the sets actually differ. */
  setRows(e: RoutineExercise): string[] {
    if (!this._isVaried(e)) return [];
    return (e.sets ?? []).map((s, i) => {
      const target =
        s.targetRepsMin != null || s.targetRepsMax != null
          ? this._repRange(s.targetRepsMin, s.targetRepsMax)
          : s.targetDurationSeconds != null
            ? this._duration(s.targetDurationSeconds)
            : '—';
      const weight = s.targetWeightKg != null ? ` · ${s.targetWeightKg} kg` : '';
      return `Set ${i + 1} · ${target}${weight}`;
    });
  }

  /** Weight and rest, the two things the summary line leaves out. */
  detailLine(e: RoutineExercise): string {
    const parts: string[] = [];
    const varied = this._isVaried(e);
    const kg = varied ? null : (e.targetWeightKg ?? e.sets?.[0]?.targetWeightKg ?? null);
    if (kg != null) parts.push(`${kg} kg`);
    const rest = e.restAfterSeconds ?? e.sets?.[0]?.restAfterSeconds ?? null;
    if (rest != null) parts.push(`${this._duration(rest)} rest`);
    return parts.join(' · ');
  }

  private _isVaried(e: RoutineExercise): boolean {
    const sets = e.sets ?? [];
    if (sets.length < 2) return false;
    const first = sets[0];
    return sets.some(
      (s) =>
        s.targetRepsMin !== first.targetRepsMin ||
        s.targetRepsMax !== first.targetRepsMax ||
        s.targetWeightKg !== first.targetWeightKg ||
        s.targetDurationSeconds !== first.targetDurationSeconds,
    );
  }

  private _repRange(min: number | null, max: number | null): string {
    return min != null && max != null && min !== max
      ? `${min}-${max}`
      : `${min ?? max}`;
  }

  private _duration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }

  start(): void {
    const r = this.routine();
    if (!r || this.starting()) return;
    this.starting.set(true);
    this._service.start(r.id).subscribe({
      next: (log) => {
        this.starting.set(false);
        void this._router.navigate(['/user/workout-log', log.id]);
      },
      error: (err) => {
        this.starting.set(false);
        showApiError(
          this._messageService,
          "Couldn't start routine",
          'Please retry.',
          err,
        );
      },
    });
  }

  duplicate(): void {
    const r = this.routine();
    if (!r) return;
    this._service.duplicate(r.id).subscribe({
      next: (copy) => {
        this._messageService.add({
          severity: 'success',
          summary: 'Saved to your routines',
          detail: `"${copy.name}" is yours to change.`,
          life: 3000,
        });
        void this._router.navigate(['/user/routines', copy.id]);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't save a copy",
          'Please try again.',
          err,
        ),
    });
  }

  edit(): void {
    this.editOpen.set(true);
  }

  onSaved(updated: Routine): void {
    this.routine.set(updated);
  }

  back(): void {
    void this._router.navigate(['/user/training'], {
      queryParams: { view: 'routines' },
    });
  }
}
