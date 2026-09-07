import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import {
  Exercise,
  ExerciseFacets,
  ExerciseKind,
  ExerciseLevel,
  ExerciseOwnershipFilter,
  ExerciseService,
  ExerciseSortKey,
  ListExercisesQuery,
} from 'core';

const PAGE_SIZE = 20;
/** The API caps `limit` at 100 — five pages is the most one request can re-read. */
const MAX_REFRESH_PAGES = 5;

/** What the filter sheet owns. The pills, the search and the sort live outside it. */
export interface ExerciseFilters {
  kinds: ExerciseKind[];
  levels: ExerciseLevel[];
  muscleIds: string[];
  equipmentIds: string[];
}

export const NO_FILTERS: ExerciseFilters = {
  kinds: [],
  levels: [],
  muscleIds: [],
  equipmentIds: [],
};

export function filterCount(filters: ExerciseFilters): number {
  return (
    filters.kinds.length +
    filters.levels.length +
    filters.muscleIds.length +
    filters.equipmentIds.length
  );
}

/**
 * The sheet's four lists as `GET /exercises` reads them. An empty list is
 * left out rather than sent as `[]` — the list request and the filter
 * sheet's live recount both build their query from this, so the two can
 * never disagree about what a filter means.
 */
export function filtersToQuery(
  filters: ExerciseFilters,
): Pick<ListExercisesQuery, 'kind' | 'level' | 'primaryMuscleId' | 'equipmentId'> {
  return {
    kind: filters.kinds.length ? filters.kinds : undefined,
    level: filters.levels.length ? filters.levels : undefined,
    primaryMuscleId: filters.muscleIds.length ? filters.muscleIds : undefined,
    equipmentId: filters.equipmentIds.length ? filters.equipmentIds : undefined,
  };
}

interface FetchOptions {
  page: number;
  limit: number;
  /** Replace the rows on screen (a query's first page) or append to them (scroll). */
  replace: boolean;
  done?: () => void;
}

/**
 * Page-scoped state for the exercise library.
 *
 * Five things narrow the catalogue — an ownership pill, a search term, a
 * sort key and two chip groups in the filter sheet — and every one of them
 * composes into the same `GET /exercises` query. They are separate signals
 * rather than one blob because they change on different gestures and only
 * some of them reset the list: sorting keeps your filters, and the design
 * says so explicitly by giving sort its own sheet.
 *
 * Facets come back on the same request (`withFacets`), so the filter sheet
 * can show counts without a second round trip. They are only asked for on a
 * replacing load — a "Load more" that recomputed four GROUP BYs would pay
 * for numbers nobody is looking at.
 */
@Injectable()
export class ExercisesStore {
  private readonly _exerciseService = inject(ExerciseService);

  readonly ownership = signal<ExerciseOwnershipFilter>(ExerciseOwnershipFilter.All);
  readonly sort = signal<ExerciseSortKey>(ExerciseSortKey.Name);
  readonly filters = signal<ExerciseFilters>(NO_FILTERS);
  /** The committed search term — the page debounces the raw input into this. */
  readonly search = signal('');

  private readonly _items = signal<Exercise[]>([]);
  private readonly _total = signal(0);
  private readonly _facets = signal<ExerciseFacets | undefined>(undefined);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  /**
   * A pill tap, a keystroke and a filter apply can all be in flight at once.
   * Each response carries the sequence it was asked under and anything stale
   * is dropped, so a slow "System" page cannot land in a "My exercises" list.
   */
  private _seq = 0;

  readonly items = this._items.asReadonly();
  readonly total = this._total.asReadonly();
  readonly facets = this._facets.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * How many full pages are on screen — derived, not tracked. A partial last
   * page rounds down, so the next scroll asks for it again: rows already
   * held are dropped by id, and anything that shifted into the gap (a row
   * deleted above it, say) is picked up rather than skipped.
   */
  private readonly _pagesLoaded = computed(() => Math.floor(this._items().length / PAGE_SIZE));

  readonly hasMore = computed(() => this._items().length < this._total());

  readonly activeFilterCount = computed(() => filterCount(this.filters()));

  readonly hasNarrowing = computed(
    () => this.activeFilterCount() > 0 || this.search().trim().length > 0,
  );

  /** First load over an empty list — the only state that may shimmer. */
  readonly showSkeleton = computed(() => this._loading() && this._items().length === 0);

  readonly showError = computed(() => this._error() && this._items().length === 0);

  private readonly _isSettledEmpty = computed(
    () => this._loaded() && !this._loading() && !this._error() && this._items().length === 0,
  );

  /** Narrowed to nothing, but the catalogue itself is not empty. */
  readonly isFilteredEmpty = computed(
    () =>
      this._isSettledEmpty() &&
      (this.hasNarrowing() || this.ownership() !== ExerciseOwnershipFilter.All),
  );

  /** Nothing at all under an unnarrowed All — a seeding problem, not a filter. */
  readonly isEmpty = computed(() => this._isSettledEmpty() && !this.isFilteredEmpty());

  // ── Loading ───────────────────────────────────────────────────────────────

  /**
   * Re-read what is on screen, in place.
   *
   * Called on every entry to the page, which includes coming back from a
   * detail three pages down the list. Re-fetching page 1 there would snap
   * the coach to the top of an 800-row catalogue; instead the whole loaded
   * window is asked for again as one request, so the rows refresh under a
   * scroll position that does not move. Past the API's cap the window is
   * trimmed to what one request can carry — the tail reloads on the next
   * scroll.
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

  // ── Query setters ─────────────────────────────────────────────────────────
  // Each starts over from a single page: a narrower query has its own first
  // page, and appending it to what is already there would mix result sets.

  setOwnership(value: ExerciseOwnershipFilter): void {
    if (value === this.ownership()) return;
    this.ownership.set(value);
    this._restart();
  }

  setSort(value: ExerciseSortKey): void {
    if (value === this.sort()) return;
    this.sort.set(value);
    this._restart();
  }

  setSearch(value: string): void {
    const next = value.trim();
    if (next === this.search()) return;
    this.search.set(next);
    this._restart();
  }

  setFilters(filters: ExerciseFilters): void {
    this.filters.set({ ...filters });
    this._restart();
  }

  /** Clears the sheet's chips, the search and the pill; the sort key is not a filter. */
  clearNarrowing(): void {
    this.filters.set(NO_FILTERS);
    this.search.set('');
    this.ownership.set(ExerciseOwnershipFilter.All);
    this._restart();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _restart(): void {
    this._fetch({ page: 1, limit: PAGE_SIZE, replace: true });
  }

  private _fetch({ page, limit, replace, done }: FetchOptions): void {
    const seq = ++this._seq;
    const search = this.search().trim();

    const query: ListExercisesQuery = {
      page,
      limit,
      ownership: this.ownership(),
      sort: this.sort(),
      search: search || undefined,
      ...filtersToQuery(this.filters()),
      withFacets: replace,
    };

    this._loading.set(true);
    this._error.set(false);

    this._exerciseService
      .list(query)
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
          if (response.facets) this._facets.set(response.facets);
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
          this._loading.set(false);
          done?.();
        },
      });
  }
}

/** Append, skipping rows already held — a re-asked partial page overlaps. */
function appendUnique(rows: Exercise[], incoming: Exercise[]): Exercise[] {
  const held = new Set(rows.map((row) => row.id));
  return [...rows, ...incoming.filter((row) => !held.has(row.id))];
}
