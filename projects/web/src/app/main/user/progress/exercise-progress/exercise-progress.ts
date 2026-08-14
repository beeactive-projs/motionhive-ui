import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';

import { ExerciseProgress, ProgressService, showApiError } from 'core';

import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

/**
 * One exercise, all of its history. Reached from the records rail on
 * Progress. Estimated 1RM over time up top, then every session's top
 * set newest first.
 *
 * The 1RM series comes from `one_rep_max`, which the completion flow
 * has been writing since V1 — this is the first surface that reads it.
 */
@Component({
  selector: 'mh-exercise-progress',
  standalone: true,
  imports: [DatePipe, ButtonDirective, Card, ListEmptyState, Skeleton, Toast],
  providers: [MessageService],
  templateUrl: './exercise-progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseProgressPage implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(ProgressService);
  private readonly _messageService = inject(MessageService);

  readonly data = signal<ExerciseProgress | null>(null);
  readonly loading = signal(false);

  readonly sessions = computed(() => this.data()?.sessions ?? []);
  readonly series = computed(() => this.data()?.oneRepMaxSeries ?? []);

  readonly best = computed(() => {
    const s = this.series();
    return s.length ? Math.max(...s.map((p) => p.weightKg)) : null;
  });

  /** Movement across the series; null until there are two points. */
  readonly trendKg = computed(() => {
    const s = this.series();
    if (s.length < 2) return null;
    return Math.round((s[s.length - 1].weightKg - s[0].weightKg) * 10) / 10;
  });

  /** Polyline points for a 1RM sparkline, normalised to a 100x32 box. */
  readonly sparkline = computed(() => {
    const s = this.series();
    if (s.length < 2) return '';
    const values = s.map((p) => p.weightKg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 32 - ((v - min) / span) * 30 - 1;
        return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
      })
      .join(' ');
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('exerciseId');
    if (!id) {
      this._router.navigate(['/user/training']);
      return;
    }
    this.loading.set(true);
    this._service.forExercise(id).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load this exercise",
          'Please try again.',
          err,
        );
      },
    });
  }

  back(): void {
    this._router.navigate(['/user/training']);
  }

  openLog(workoutLogId: string): void {
    this._router.navigate(['/user/workout-log', workoutLogId, 'replay']);
  }

  /** Reps of the heaviest set, formatted for the row. */
  topSetLabel(s: ExerciseProgress['sessions'][number]): string {
    if (s.topWeightKg != null) {
      return s.topReps != null
        ? `${s.topWeightKg} kg × ${s.topReps}`
        : `${s.topWeightKg} kg`;
    }
    if (s.bestDurationSeconds != null) {
      const m = Math.floor(s.bestDurationSeconds / 60);
      const sec = s.bestDurationSeconds % 60;
      return `${m}:${String(sec).padStart(2, '0')}`;
    }
    if (s.bestDistanceMeters != null) {
      return `${Math.round(s.bestDistanceMeters / 10) / 100} km`;
    }
    return s.topReps != null ? `${s.topReps} reps` : '—';
  }
}
