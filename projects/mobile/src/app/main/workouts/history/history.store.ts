import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import {
  STORAGE_KEYS,
  WorkoutLog,
  WorkoutLogService,
  WorkoutMemory,
  dayRange,
  monthRange,
  startOfMonth,
} from 'core';

import { PagedList } from '../../../_shared/utils/paged-list';
import { calendarCells, monthDoneCount } from '../workouts.config';

/** A page of History; Show more reads the next. */
const PAGE_SIZE = 15;

/** History's chips: everything, only the ones with a photo, or with a record. */
export const HistoryFilters = {
  All: 'all',
  Photos: 'photo',
  Records: 'record',
} as const;

export type HistoryFilter = (typeof HistoryFilters)[keyof typeof HistoryFilters];
/**
 * One request's worth of a month for the calendar. The API caps `limit` at
 * 100; a month with more logs than that shows its first hundred, which no one
 * training once or twice a day reaches.
 */
const MONTH_LIMIT = 100;

/**
 * State for the training history, the Workouts page's History tab.
 *
 * Everything logged, newest first, paged. Skipped days of a plan stay in the
 * list (the API's `kind=all` returns them as SKIPPED rows) rather than
 * disappearing — a skip was a decision, and a history that hides them reads
 * as a cleaner training record than the one that actually happened. The
 * photo and record chips are finished workouts only. A day tapped on the
 * calendar narrows the list to it.
 *
 * The paging is a `PagedList`: `refresh` re-reads the whole loaded window in
 * place so coming back from a workout three pages down does not snap the list
 * to the top, and a response is dropped if a newer request has gone out since.
 */
@Injectable()
export class HistoryStore {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _translateService = inject(TranslateService);

  private readonly _filter = signal<HistoryFilter>(HistoryFilters.All);
  private readonly _memory = signal<WorkoutMemory | null>(null);
  private readonly _day = signal<string | null>(null);
  private readonly _calendarOpen = signal(false);

  private readonly _list = new PagedList<WorkoutLog>(PAGE_SIZE, (page, limit) => {
    const filter = this._filter();
    const day = this._day();
    return this._workoutLogService.list({
      page,
      limit,
      ...(filter === HistoryFilters.All ? { kind: 'all' as const } : { has: filter }),
      ...(day ? dayRange(day) : {}),
    });
  });

  readonly items = this._list.items;
  readonly filter = this._filter.asReadonly();
  /** A workout from a while back next to real progress since; null when there is none. */
  readonly memory = this._memory.asReadonly();
  readonly total = this._list.total;
  readonly loading = this._list.loading;
  /** The calendar day the list is narrowed to, as `yyyy-mm-dd`; null for every day. */
  readonly day = this._day.asReadonly();
  /** The calendar shows when asked for, from the button beside the chips. */
  readonly calendarOpen = this._calendarOpen.asReadonly();

  readonly hasMore = this._list.hasMore;

  /** First load over an empty list — the only state that may shimmer. */
  readonly showSkeleton = computed(() => this._list.loading() && this._list.items().length === 0);

  readonly showError = computed(() => this._list.failed() && this._list.items().length === 0);

  readonly isEmpty = computed(
    () =>
      this._list.loaded() &&
      !this._list.loading() &&
      !this._list.failed() &&
      this._list.items().length === 0,
  );

  /**
   * "12 workouts with a photo", or with a record. None under All, whose
   * rows count skipped days too.
   */
  readonly countLabel = computed(() => {
    if (this._filter() === HistoryFilters.All) return '';
    const key =
      this._filter() === HistoryFilters.Photos
        ? 'workouts.history.countPhotos'
        : 'workouts.history.countRecords';
    return this._translateService.instant(key, { count: this._list.total() });
  });

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
    this._list.refresh(done);
    this.refreshMonth();
    this._fetchMemory();
  }

  /** A chip: the list starts over under the new filter. */
  setFilter(filter: HistoryFilter): void {
    if (filter === this._filter()) return;
    this._filter.set(filter);
    this._restart();
  }

  /** Narrow the list to a calendar day, or null for every day again. */
  setDay(key: string | null): void {
    if (key === this._day()) return;
    this._day.set(key);
    this._restart();
  }

  toggleCalendar(): void {
    this._calendarOpen.update((open) => !open);
  }

  private _restart(): void {
    this._list.clear();
    this._list.reset();
  }

  /** Quiet on failure: History stands without its memory. */
  private _fetchMemory(): void {
    this._workoutLogService
      .getMemory()
      .pipe(take(1))
      .subscribe({ next: (memory) => this._memory.set(memory ?? null), error: () => undefined });
  }

  setMonth(month: Date): void {
    this._month.set(startOfMonth(month));
    this._monthLogs.set([]);
    this._monthLoaded.set(false);
    this.refreshMonth();
  }

  refreshMonth(): void {
    const seq = ++this._monthSeq;
    this._monthLoading.set(true);
    this._monthError.set(false);

    this._workoutLogService
      .list({ kind: 'all', limit: MONTH_LIMIT, ...monthRange(this._month()) })
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
    this._list.more(done);
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
