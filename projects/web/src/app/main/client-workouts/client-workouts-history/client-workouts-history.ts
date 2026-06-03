import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';

interface MonthGroup {
  label: string;
  logs: WorkoutLog[];
}

interface HistoryRow {
  log: WorkoutLog;
  /** "12-week hypertrophy base · W5" — null for freestyle. */
  subtitle: string | null;
  durationMin: number | null;
  setsDone: number;
  feelingGlyph: string | null;
}

/**
 * Client workout history (S13 — `/my/workouts`).
 *
 * Reverse-chronological list of COMPLETED workout logs, grouped by
 * month. Each row → the read-only replay (S11 read-mode, ships with
 * the active-log slice). Lives on its own route per the locked
 * decision — history spans every plan a client has ever done.
 *
 * Filters (program, date range) are stubbed until the BE supports
 * them. The card-style rows match the design's compact row pattern.
 */
@Component({
  selector: 'mh-client-workouts-history',
  standalone: true,
  imports: [DatePipe, ButtonModule, Toast],
  providers: [MessageService],
  templateUrl: './client-workouts-history.html',
  styleUrl: './client-workouts-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkoutsHistory {
  private readonly _service = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  readonly items = signal<WorkoutLog[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 30;

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly rows = computed<HistoryRow[]>(() =>
    this.items().map((l) => this._toRow(l)),
  );

  readonly totalTrainingHours = computed(() => {
    const totalSec = this.items().reduce(
      (n, l) => n + (l.durationSeconds ?? 0),
      0,
    );
    return Math.round(totalSec / 3600);
  });

  readonly months = computed<MonthGroup[]>(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const l of this.items()) {
      const d = new Date(l.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
      // Stash label on the first push by encoding into the key separately.
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, logs]) => {
        const d = new Date(logs[0].startedAt);
        return {
          label: d.toLocaleString('en', { month: 'long', year: 'numeric' }),
          logs,
        };
      });
  });

  private readonly _feelingGlyphs = ['😣', '😕', '😐', '🙂', '💪'];

  constructor() {
    effect(() => {
      this.page.set(1);
      this.fetch(true);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  openReplay(log: WorkoutLog): void {
    // S11 read-mode lands with the active log slice. For now a polite
    // stub so the route doesn't dead-end.
    this._messageService.add({
      severity: 'info',
      summary: 'Replay lands with S11',
      detail: `Read-only replay of "${log.name}" arrives with the active log.`,
      life: 3000,
    });
  }

  goToPlans(): void {
    this._router.navigate(['/my/plans']);
  }

  // ── Template helpers ─────────────────────────────────────────────

  feelingGlyph(log: WorkoutLog): string | null {
    if (log.feelingRating == null) return null;
    const idx = Math.max(1, Math.min(5, log.feelingRating)) - 1;
    return this._feelingGlyphs[idx];
  }

  // ── Internals ────────────────────────────────────────────────────

  private _toRow(log: WorkoutLog): HistoryRow {
    const subtitle = log.assignment
      ? log.assignment.programNameSnapshot
      : null;
    const durationMin =
      log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : null;
    const setsDone = (log.exercises ?? []).reduce(
      (n: number, e: LoggedExercise) =>
        n + (e.sets ?? []).filter((s: LoggedSet) => s.isCompleted).length,
      0,
    );
    return {
      log,
      subtitle,
      durationMin,
      setsDone,
      feelingGlyph: this.feelingGlyph(log),
    };
  }

  private fetch(replace: boolean): void {
    if (replace) this.loading.set(true);
    else this.loadingMore.set(true);

    const settle = (): void => {
      this.loading.set(false);
      this.loadingMore.set(false);
    };

    this._service.list({ page: this.page(), limit: this.pageSize }).subscribe({
      next: (res) => {
        if (replace) this.items.set(res.items);
        else this.items.update((cur) => [...cur, ...res.items]);
        this.total.set(res.total);
        settle();
      },
      error: (err) => {
        settle();
        showApiError(
          this._messageService,
          "Couldn't load your history",
          'Check your connection and try again.',
          err,
        );
      },
    });
  }
}
