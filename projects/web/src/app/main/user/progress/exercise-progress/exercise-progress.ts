import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';

import { ExerciseProgress, ProgressService, appLocale, showApiError } from 'core';

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
  imports: [DatePipe, ButtonDirective, Card, ListEmptyState, Skeleton, Toast, TranslatePipe],
  providers: [MessageService],
  templateUrl: './exercise-progress.html',
})
export class ExerciseProgressPage implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(ProgressService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  /** Kilos and kilometres — locale decimals, no grouping (as before). */
  private readonly _numberFormat = new Intl.NumberFormat(appLocale(), {
    maximumFractionDigits: 2,
    useGrouping: false,
  });

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
          this._translateService.instant('training.exerciseProgress.loadFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
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

  /** Locale decimal separator, no grouping — `82.5` / `82,5`. */
  formatNumber(value: number): string {
    return this._numberFormat.format(value);
  }

  /** Reps of the heaviest set, formatted for the row. */
  topSetLabel(s: ExerciseProgress['sessions'][number]): string {
    if (s.topWeightKg != null) {
      const weight = this.formatNumber(s.topWeightKg);
      return s.topReps != null
        ? this._translateService.instant('training.exerciseProgress.weightTimesReps', {
            weight,
            reps: s.topReps,
          })
        : this._translateService.instant('training.common.weightKg', { weight });
    }
    if (s.bestDurationSeconds != null) {
      const m = Math.floor(s.bestDurationSeconds / 60);
      const sec = s.bestDurationSeconds % 60;
      return `${m}:${String(sec).padStart(2, '0')}`;
    }
    if (s.bestDistanceMeters != null) {
      return this._translateService.instant('training.exerciseProgress.km', {
        distance: this.formatNumber(Math.round(s.bestDistanceMeters / 10) / 100),
      });
    }
    return s.topReps != null
      ? this._translateService.instant('count.reps', { count: s.topReps })
      : '—';
  }
}
