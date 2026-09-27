import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService } from 'core';

const PAGE_SIZE = 25;
/** The API caps `limit` at 100 — four pages is the most one request can re-read. */
const MAX_REFRESH_PAGES = 4;

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
  readonly countLabel = computed(() => {
    const total = this._total();
    return `${total} ${total === 1 ? 'workout' : 'workouts'} logged`;
  });

  /**
   * Re-read what is on screen, in place. Called on every entry to the page:
   * a workout finished on another screen belongs at the top of this one.
   */
  refresh(done?: () => void): void {
    const pages = Math.min(Math.max(this._pagesLoaded(), 1), MAX_REFRESH_PAGES);
    this._fetch({ page: 1, limit: pages * PAGE_SIZE, replace: true, done });
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

/** Append, skipping rows already held — a re-asked partial page overlaps. */
function appendUnique(rows: WorkoutLog[], incoming: WorkoutLog[]): WorkoutLog[] {
  const held = new Set(rows.map((row) => row.id));
  return [...rows, ...incoming.filter((row) => !held.has(row.id))];
}
