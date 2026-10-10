import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import { STORAGE_KEYS, WorkoutLog, WorkoutLogService, startOfMonth } from 'core';

import { calendarCells, monthDoneCount } from '../workouts.config';

const PAGE_SIZE = 25;
/** The API caps `limit` at 100 — four pages is the most one request can re-read. */
const MAX_REFRESH_PAGES = 4;
/**
 * One request's worth of a month for the calendar. The API caps `limit` at
 * 100; a month with more logs than that shows its first hundred, which no one
 * training once or twice a day reaches.
 */
const MONTH_LIMIT = 100;

interface FetchOptions {
  page: number;
  limit: number;
  /** Replace the rows on screen (a refresh) or append to them (scroll). */
  replace: boolean;
  done?: () => void;
}

/**
 * Page-scoped state for the training history.
 *
 * Everything logged, newest first, paged. Skipped days stay in the list
 * rather than disappearing — a skip was a decision, and a history that hides
 * them reads as a cleaner training record than the one that actually
 * happened.
 *
 * Same shape as the exercise library's store: `refresh` re-reads the whole
 * loaded window in place so coming back from a workout three pages down does
 * not snap the list to the top, and a response is dropped if a newer request
 * has gone out since.
 */
@Injectable()
export class HistoryStore {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _translateService = inject(TranslateService);

  private readonly _items = signal<WorkoutLog[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  private _seq = 0;

  readonly items = this._items.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly _pagesLoaded = computed(() => Math.floor(this._items().length / PAGE_SIZE));

  readonly hasMore = computed(() => this._items().length < this._total());

  /** First load over an empty list — the only state that may shimmer. */
  readonly showSkeleton = computed(() => this._loading() && this._items().length === 0);

  readonly showError = computed(() => this._error() && this._items().length === 0);

  readonly isEmpty = computed(
    () => this._loaded() && !this._loading() && !this._error() && this._items().length === 0,
  );

  /** "42 workouts logged" — the line that says how big the record is. */
  readonly countLabel = computed(() =>
    this._translateService.instant('workouts.history.count', { count: this._total() }),
  );

  // ─── Calendar ──────────────────────────────────────────────────────────
  // A month window of its own, independent of the paged list: scrolling the
  // list never moves the calendar, and paging the calendar never reloads the
  // list.

  private readonly _month = signal(startOfMonth(new Date()));
  private readonly _monthLogs = signal<WorkoutLog[]>([]);
  private readonly _monthLoading = signal(false);
  private readonly _monthLoaded = signal(false);
  private readonly _monthError = signal(false);
  private readonly _collapsed = signal(readCollapsed());
  private _monthSeq = 0;

  readonly month = this._month.asReadonly();
  readonly monthError = this._monthError.asReadonly();
  readonly collapsed = this._collapsed.asReadonly();

  /** Only the first read of a month shimmers; a re-read keeps the grid. */
  readonly monthSkeleton = computed(() => this._monthLoading() && !this._monthLoaded());

  readonly calendarCells = computed(() =>
    calendarCells(this._month(), this._monthLogs(), new Date()),
  );

  readonly monthDoneCount = computed(() => monthDoneCount(this._monthLogs(), this._month()));

  /**
   * Re-read what is on screen, in place. Called on every entry to the page:
   * a workout finished on another screen belongs at the top of this one, and
   * on its day in the calendar.
   */
  refresh(done?: () => void): void {
    const pages = Math.min(Math.max(this._pagesLoaded(), 1), MAX_REFRESH_PAGES);
    this._fetch({ page: 1, limit: pages * PAGE_SIZE, replace: true, done });
    this.refreshMonth();
  }

  setMonth(month: Date): void {
    this._month.set(startOfMonth(month));
    this._monthLogs.set([]);
    this._monthLoaded.set(false);
    this.refreshMonth();
  }

  refreshMonth(): void {
    const seq = ++this._monthSeq;
    const from = this._month();
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    this._monthLoading.set(true);
    this._monthError.set(false);

    this._workoutLogService
      .list({ dateFrom: from.toISOString(), dateTo: to.toISOString(), limit: MONTH_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          // Paging back fast fires several months; only the last one asked
          // may land, or the grid shows one month's days under another's name.
          if (seq !== this._monthSeq) return;
          this._monthLogs.set(response.items);
          this._monthLoaded.set(true);
          this._monthLoading.set(false);
        },
        error: () => {
          if (seq !== this._monthSeq) return;
          this._monthError.set(true);
          this._monthLoaded.set(true);
          this._monthLoading.set(false);
        },
      });
  }

  setCollapsed(collapsed: boolean): void {
    this._collapsed.set(collapsed);
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY_CALENDAR_COLLAPSED, String(collapsed));
    } catch {
      // Private mode or a full quota: the choice still holds for this visit.
    }
  }

  loadMore(done?: () => void): void {
    if (this._loading() || !this.hasMore()) {
      done?.();
      return;
    }
    this._fetch({ page: this._pagesLoaded() + 1, limit: PAGE_SIZE, replace: false, done });
  }

  private _fetch({ page, limit, replace, done }: FetchOptions): void {
    const seq = ++this._seq;
    this._loading.set(true);
    this._error.set(false);

    this._workoutLogService
      .list({ page, limit })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          this._items.update((rows) =>
            replace ? response.items : appendUnique(rows, response.items),
          );
          this._total.set(response.total);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          // A failed later page keeps what we have; the next scroll retries.
          if (replace) this._error.set(true);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
      });
  }
}

/** The calendar opens full unless it was folded last time. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.HISTORY_CALENDAR_COLLAPSED) === 'true';
  } catch {
    return false;
  }
}

/** Append, skipping rows already held — a re-asked partial page overlaps. */
function appendUnique(rows: WorkoutLog[], incoming: WorkoutLog[]): WorkoutLog[] {
  const held = new Set(rows.map((row) => row.id));
  return [...rows, ...incoming.filter((row) => !held.has(row.id))];
}
