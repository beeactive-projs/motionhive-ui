import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';

import {
  CategoryStore,
  CoachDirectoryFacets,
  InstructorSearchResult,
  ProfileService,
  withCategorySpecialties,
} from 'core';

import {
  CoachFilterId,
  CoachFilterIds,
  CoachSheetFilters,
  MIN_SEARCH_LENGTH,
  NO_SHEET_FILTERS,
  directoryParams,
  matchesCoachQuery,
  narrowsDirectory,
  sheetFilterCount,
} from './coaches.filters';

const PAGE_SIZE = 20;

/**
 * How long an unforced re-entry leaves what is on screen alone: long enough
 * to cover stepping into a profile and straight back out. Same window as the
 * Clients tab's.
 */
const FRESH_MS = 15_000;

const NO_FACETS: CoachDirectoryFacets = { cities: [], specializations: [] };

/**
 * `done` carries what went wrong, or nothing when the load settled. A
 * refresher has to stop spinning either way.
 */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for the coach directory: one paged list off
 * `/profile/instructors/directory`, narrowed on the server by the quick chip,
 * the filter sheet and the search term, plus the facets the sheet offers.
 *
 * The Yours chip is not the directory (that is `CoachesStore`): choosing it
 * keeps the directory rows as they are, so coming back to the chip before
 * reloads nothing.
 *
 * Every loader fires `done` on every exit (success, error, or the dedup
 * early-return), so a refresher spinner can never hang.
 */
@Injectable()
export class CoachDirectoryStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _categoryStore = inject(CategoryStore);
  /** The page's, since the store is provided by it. */
  private readonly _destroyRef = inject(DestroyRef);

  readonly filter = signal<CoachFilterId>(CoachFilterIds.All);
  readonly query = signal('');
  /** The sheet's picks on screen; empty while a chip other than All is the view. */
  readonly sheet = signal<CoachSheetFilters>(NO_SHEET_FILTERS);
  /** Picks a chip set aside, offered again the next time the sheet opens. */
  private readonly _keptSheet = signal<CoachSheetFilters | null>(null);
  /** What the sheet opens on: the picks on screen, or the ones set aside. */
  readonly sheetDraft = computed(() =>
    sheetFilterCount(this.sheet()) > 0 ? this.sheet() : (this._keptSheet() ?? this.sheet()),
  );
  /** What "Near you" narrows to; the page sets it from the reader's city. */
  readonly nearCity = signal<string | null>(null);
  /** Search is open: its results cover the whole directory. */
  readonly searching = signal(false);

  private readonly _coaches = signal<InstructorSearchResult[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);
  /** What the last response actually searched for. */
  private readonly _appliedQuery = signal('');
  /**
   * How many coaches the directory has at all, which tells "nobody here yet"
   * apart from a filter that hid everyone. Written only by an unnarrowed
   * first page.
   */
  private readonly _allTotal = signal<number | null>(null);
  private readonly _facets = signal<CoachDirectoryFacets>(NO_FACETS);

  /**
   * A newer request can start while an older one is in flight. Responses
   * carry the sequence they were asked under and anything stale is dropped,
   * so a slow "Online" page can never land in a "Taking clients" list.
   */
  private _seq = 0;
  private _fetchedAt = 0;
  /** The request the rows on screen answer, page aside. */
  private _loadedKey: string | null = null;

  readonly facets = this._facets.asReadonly();

  /** The part of the search the API is asked to act on: nothing, below its floor. */
  private readonly _serverQuery = computed(() => {
    const term = this.query().trim();
    return term.length >= MIN_SEARCH_LENGTH ? term : '';
  });

  /** Typed, but not yet enough to search on. Said under the field. */
  readonly queryTooShort = computed(() => {
    const term = this.query().trim();
    return term.length > 0 && term.length < MIN_SEARCH_LENGTH;
  });

  /** The directory chips only: Yours shows the reader's own coaches instead. */
  private readonly _onDirectory = computed(() => this.filter() !== CoachFilterIds.Yours);

  /**
   * The rows on screen. The API has applied whatever it could search on;
   * this re-narrows while a newer term is still in flight, and permanently
   * for a term below the floor, which was never sent.
   */
  readonly visibleCoaches = computed(() => {
    const query = this.query().trim();
    // A coach who picked categories and wrote no specializations shows the
    // categories' names on their row (and is found by them).
    const byId = this._categoryStore.byId();
    const coaches = this._coaches().map((coach) => withCategorySpecialties(coach, byId));
    if (!query || query === this._appliedQuery()) return coaches;
    return coaches.filter((coach) => matchesCoachQuery(coach, query));
  });

  readonly hasMore = computed(() => this._coaches().length < this._total());

  readonly showSkeleton = computed(() => this._loading() && this._coaches().length === 0);

  readonly showLoadError = computed(() => this._error() && this._coaches().length === 0);

  /** Nobody in the directory at all. Survives a chip change. */
  readonly isEmpty = computed(() => this._allTotal() === 0);

  /** A chip, the sheet or the search hid everyone, but there are coaches. */
  readonly isFilteredEmpty = computed(
    () =>
      !this.isEmpty() &&
      this._loaded() &&
      !this._loading() &&
      !this._error() &&
      this.visibleCoaches().length === 0,
  );

  /** The rows are the answer to what is in the box; nothing is on its way. */
  readonly searchSettled = computed(() => this._serverQuery() === this._appliedQuery());

  /** The last load failed, but rows from an earlier one are still showing. */
  readonly isStale = computed(() => this._error() && this._coaches().length > 0);

  /** Page 1 for what is on screen. `force` restarts even mid-flight. */
  load(opts: LoadOptions = {}): void {
    this._categoryStore.ensureLoaded();
    if (!opts.force && (this._loading() || this._loaded())) {
      opts.done?.();
      return;
    }
    this._fetchPage(1, opts.done);
  }

  /** The list and the facets again. Quiet: a failure raises the stale bar. */
  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
    this.loadFacets(true);
  }

  /**
   * Entering the screen. Ionic keeps it alive in its stack, so a coach who
   * opened their doors since has to be picked up, but stepping into a
   * profile and straight back out should not reload data seconds old.
   */
  reenter(): void {
    if (this._fetchedAt > 0 && Date.now() - this._fetchedAt < FRESH_MS) return;
    this.refresh();
  }

  /** Infinite scroll: appends the next page. */
  loadMore(done?: (error?: unknown) => void): void {
    if (this._loading() || !this.hasMore()) {
      done?.();
      return;
    }
    this._fetchPage(this._page() + 1, done);
  }

  /**
   * Requests sent or withdrawn on a coach's profile, patched onto the rows on
   * screen: the next load brings the same from the API. The Requests chip
   * reloads instead, since a request withdrawn there takes its row with it
   * and the list is short enough that nobody is deep in it.
   */
  patchRequests(requests: ReadonlyMap<string, boolean>): void {
    if (requests.size === 0) return;
    if (this.filter() === CoachFilterIds.Requests) {
      this.load({ force: true });
      return;
    }
    this._coaches.update((list) =>
      list.map((coach) =>
        requests.has(coach.userId) ? { ...coach, requestSent: requests.get(coach.userId) } : coach,
      ),
    );
  }

  /** Once per screen unless forced; a failure only means a shorter sheet. */
  loadFacets(force = false): void {
    if (!force && this._facets() !== NO_FACETS) return;
    this._profileService
      .coachDirectoryFacets({ silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({ next: (facets) => this._facets.set(facets), error: () => undefined });
  }

  /**
   * A chip and the sheet's picks are one choice, as the strip shows only one
   * thing on: picking a chip, All included, sets the picks aside. The sheet
   * opens on them again, so Apply brings them back.
   */
  setFilter(id: CoachFilterId): void {
    const picks = this.sheet();
    if (id === this.filter() && sheetFilterCount(picks) === 0) return;
    if (sheetFilterCount(picks) > 0) this._keptSheet.set(picks);
    this.filter.set(id);
    this.sheet.set(NO_SHEET_FILTERS);
    this._sync();
  }

  /** Debounced by the page: every term the API can use is a request. */
  setQuery(value: string): void {
    if (value === this.query()) return;
    this.query.set(value);
    this._sync();
  }

  /** ...and picks in the sheet put the chip back on All, under them. */
  setSheet(filters: CoachSheetFilters): void {
    this.sheet.set(filters);
    this._keptSheet.set(null);
    if (sheetFilterCount(filters) > 0) this.filter.set(CoachFilterIds.All);
    this._sync();
  }

  setNearCity(city: string | null): void {
    if (city === this.nearCity()) return;
    this.nearCity.set(city);
    this._sync();
  }

  setSearching(searching: boolean): void {
    if (searching === this.searching()) return;
    this.searching.set(searching);
    this._sync();
  }

  /** Drops the chip, the sheet and the search together, in one request. */
  clearFilters(): void {
    this.query.set('');
    this.sheet.set(NO_SHEET_FILTERS);
    this._keptSheet.set(null);
    this.filter.set(CoachFilterIds.All);
    this._sync();
  }

  /** The directory request for what is on screen, page aside. */
  private _request(page: number) {
    return directoryParams({
      filter: this.filter(),
      sheet: this.sheet(),
      query: this._serverQuery(),
      nearCity: this.nearCity(),
      searching: this.searching(),
      page,
      limit: PAGE_SIZE,
    });
  }

  /**
   * Reloads from page 1 when what is on screen asks for something the rows do
   * not answer. Yours lists nothing from here, so it never reloads; and a
   * keystroke the API would answer the same way (a third letter on a term it
   * has, a first one it cannot use yet) only re-narrows in memory.
   */
  private _sync(): void {
    if (!this._onDirectory()) return;
    if (this._requestKey() === this._loadedKey && !this._error()) return;
    this._coaches.set([]);
    this._total.set(0);
    this._page.set(1);
    this._loaded.set(false);
    this._fetchPage(1);
  }

  private _requestKey(): string {
    return JSON.stringify(this._request(1));
  }

  private _fetchPage(page: number, done?: (error?: unknown) => void): void {
    const seq = ++this._seq;
    const params = this._request(page);
    const key = this._requestKey();
    this._loading.set(true);
    this._error.set(false);

    // Silent: the screen reports a failed load itself, inline and with a
    // retry; a modal on top would be the same failure told twice.
    this._profileService
      .coachDirectory(params, { silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          this._coaches.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._total.set(response.total);
          this._page.set(page);
          this._appliedQuery.set(params.search ?? '');
          this._loadedKey = key;
          this._fetchedAt = Date.now();
          if (!narrowsDirectory(params)) this._allTotal.set(response.total);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: (error: unknown) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._error.set(true);
          this._loading.set(false);
          done?.(error);
        },
      });
  }
}
