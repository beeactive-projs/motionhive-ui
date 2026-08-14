import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import {
  groupSessionsByBucket,
  injectIsMobile,
  showApiError,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { SectionLabel } from '../../../_shared/components/section-label/section-label';
import { TimeRowSkeleton } from '../../../_shared/components/time-row-skeleton/time-row-skeleton';
import { WorkoutRow } from '../my-workouts/_components/workout-row/workout-row';

interface HistoryGroup {
  label: string;
  count: number;
  multiDay: boolean;
  logs: WorkoutLog[];
}

/**
 * What you actually did, newest first.
 *
 * Extracted from the Workouts page so it can sit under Training ▸ History
 * next to the progress summary. Those two were separate destinations
 * showing the same data at different zoom levels — the summary is
 * arithmetic over exactly this list — so they belong together.
 *
 * Owns its own paging and fetch; the host supplies nothing.
 */
@Component({
  selector: 'mh-workout-history',
  standalone: true,
  imports: [
    FormsModule,
    ButtonDirective,
    IconField,
    InputIcon,
    InputTextModule,
    ListEmptyState,
    SectionLabel,
    TimeRowSkeleton,
    WorkoutRow,
  ],
  templateUrl: './workout-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutHistory implements OnInit {
  private readonly _service = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  protected readonly isMobile = injectIsMobile();

  /** The host owns the "start a workout" affordance, so bubble it up. */
  readonly startWorkout = output<void>();

  readonly items = signal<WorkoutLog[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 30;

  /**
   * Searched on the server, not in the browser: the list is paged, so
   * filtering what happens to be loaded would quietly miss everything
   * past the first page.
   */
  readonly search = signal('');

  readonly hasMore = computed(() => this.items().length < this.total());

  /**
   * Grouped into relative buckets (Today / Yesterday / Earlier this week /
   * by month), newest-first — the same `'past'` bucketing the sessions
   * lists use, so history reads consistently across the app.
   */
  readonly historyGroups = computed<HistoryGroup[]>(() =>
    groupSessionsByBucket(this.items(), (l) => l.startedAt, 'past').map((g) => ({
      label: g.bucket.label,
      count: g.items.length,
      multiDay: g.bucket.multiDay,
      logs: g.items,
    })),
  );

  ngOnInit(): void {
    this.fetch(true);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.fetch(true);
  }

  clearSearch(): void {
    if (!this.search()) return;
    this.search.set('');
    this.page.set(1);
    this.fetch(true);
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  /** Open whatever produced this session: the plan, or the routine. */
  openSource(src: { kind: 'plan' | 'routine'; id: string }): void {
    void this._router.navigate(
      src.kind === 'plan'
        ? ['/user/plans', src.id]
        : ['/user/training'],
      src.kind === 'routine'
        ? { queryParams: { view: 'routines', routine: src.id } }
        : {},
    );
  }

  openReplay(log: WorkoutLog): void {
    void this._router.navigate(['/user/workout-log', log.id, 'replay']);
  }

  /**
   * Not an effect: `fetch()` reads `page()`, so an effect would track it
   * and re-fire on every `loadMore()` — resetting page→1 and clobbering
   * its own pagination.
   */
  private fetch(replace: boolean): void {
    if (replace) this.loading.set(true);
    else this.loadingMore.set(true);

    const settle = (): void => {
      this.loading.set(false);
      this.loadingMore.set(false);
    };

    this._service
      .list({
        page: this.page(),
        limit: this.pageSize,
        search: this.search().trim() || undefined,
      })
      .subscribe({
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
