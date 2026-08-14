import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';

import {
  ProgressOverview,
  ProgressRange,
  ProgressService,
  showApiError,
} from 'core';

import { KpiCard } from '../../../_shared/components/kpi-card/kpi-card';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';

/**
 * Progress — the payoff surface, and the reason logging is worth the
 * effort. Personal records were already computed on every completion
 * and shown once on the summary screen, then never again; this is where
 * they live.
 *
 * Fully self-contained: it never mentions a coach, because for a lot of
 * people there isn't one and this is the main thing they stay for.
 *
 * Progressive disclosure rather than degradation. The surface grows
 * with the data instead of rendering empty charts:
 *   1 workout   → records and a baseline framing
 *   3+          → consistency dots
 *   4+ weeks    → the volume trend and streaks
 * Nothing ever shows as an empty skeleton with "not enough data".
 */
@Component({
  selector: 'mh-user-progress',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonDirective,
    Card,
    KpiCard,
    ListEmptyState,
    SelectButton,
    Skeleton,
  ],
  templateUrl: './progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress implements OnInit {
  private readonly _service = inject(ProgressService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  readonly data = signal<ProgressOverview | null>(null);
  readonly loading = signal(false);
  readonly range = signal<ProgressRange>('12w');
  /**
   * Emitted when the user taps one of the empty-state/early-state
   * Start Workout CTAs. The parent (training shell) is expected to
   * open the freestyle-start flow — this component doesn't own that
   * dialog and can't just navigate the user, because /user/training
   * IS the current route.
   */
  readonly startWorkout = output<void>();

  readonly rangeOptions = [
    { label: '4 weeks', value: '4w' as ProgressRange },
    { label: '12 weeks', value: '12w' as ProgressRange },
    { label: '1 year', value: '1y' as ProgressRange },
  ];

  // ── Which version of the surface to render ───────────────────────

  readonly lifetimeWorkouts = computed(
    () => this.data()?.lifetimeWorkouts ?? 0,
  );
  /** Nothing logged ever. Points outward, at training. */
  readonly isEmpty = computed(
    () => !this.loading() && this.lifetimeWorkouts() === 0,
  );
  /** One or two workouts in. A start, not a broken dashboard. */
  readonly isEarly = computed(
    () => this.lifetimeWorkouts() > 0 && this.lifetimeWorkouts() < 3,
  );
  readonly showsTrend = computed(
    () => (this.data()?.weeklyVolume.length ?? 0) >= 2,
  );
  readonly showsConsistency = computed(() => this.lifetimeWorkouts() >= 3);

  // ── Headline numbers ─────────────────────────────────────────────

  readonly workouts = computed(() => this.data()?.totals.workouts ?? 0);
  readonly volumeKg = computed(() => this.data()?.totals.volumeKg ?? 0);
  readonly records = computed(() => this.data()?.records ?? []);

  /** Compact for a stat tile: 61200 reads as "61.2k". */
  readonly volumeLabel = computed(() => {
    const v = this.volumeKg();
    if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
    return String(v);
  });

  readonly trainingHours = computed(() => {
    const s = this.data()?.totals.trainingSeconds ?? 0;
    return Math.round(s / 360) / 10;
  });

  /**
   * Deltas render in the KPI card's `sub` slot, so they resolve to a
   * string here rather than to markup in the template. Undefined when
   * there's no prior window worth comparing against.
   */
  readonly workoutsDeltaLabel = computed(() => {
    const d = this.data();
    if (!d || d.previous.workouts === 0) return undefined;
    const delta = d.totals.workouts - d.previous.workouts;
    if (delta === 0) return 'same as previous';
    return `${delta > 0 ? '+' : ''}${delta} vs previous`;
  });

  readonly volumeDeltaLabel = computed(() => {
    const d = this.data();
    if (!d || d.previous.volumeKg === 0) return undefined;
    const pct = Math.round(
      ((d.totals.volumeKg - d.previous.volumeKg) / d.previous.volumeKg) * 100,
    );
    if (pct === 0) return 'same as previous';
    return `${pct > 0 ? '+' : ''}${pct}% vs previous`;
  });

  readonly streakLabel = computed(() => {
    const w = this.data()?.streak.currentWeeks ?? 0;
    return w === 1 ? '1 wk' : `${w} wks`;
  });

  readonly bestStreakLabel = computed(() => {
    const best = this.data()?.streak.bestWeeks ?? 0;
    return best > 0 ? `best ${best}` : undefined;
  });

  readonly weeklyPerWeek = computed(() => {
    const weeks = this.data()?.weeklyVolume ?? [];
    if (!weeks.length) return 0;
    const total = weeks.reduce((sum, w) => sum + w.workouts, 0);
    return Math.round((total / weeks.length) * 10) / 10;
  });

  /** Bar heights as percentages of the tallest week. */
  readonly volumeBars = computed(() => {
    const weeks = this.data()?.weeklyVolume ?? [];
    const peak = Math.max(...weeks.map((w) => w.volumeKg), 1);
    return weeks.map((w) => ({
      ...w,
      heightPercent: Math.max(4, Math.round((w.volumeKg / peak) * 100)),
    }));
  });

  /** Last 28 days as a dot grid, oldest first, gaps filled with zeroes. */
  readonly consistencyDays = computed(() => {
    const byDate = new Map(
      (this.data()?.dailyActivity ?? []).map((d) => [d.date, d.workouts]),
    );
    const out: Array<{ date: string; workouts: number }> = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - i,
        ),
      );
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, workouts: byDate.get(key) ?? 0 });
    }
    return out;
  });

  ngOnInit(): void {
    this.fetch();
  }

  setRange(range: ProgressRange): void {
    if (range === this.range()) return;
    this.range.set(range);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this._service.overview(this.range()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load your progress",
          'Please try again.',
          err,
        );
      },
    });
  }

  goToWorkouts(): void {
    this._router.navigate(['/user/training']);
  }

  openExercise(exerciseId: string): void {
    this._router.navigate(['/user/progress/exercises', exerciseId]);
  }
}
