import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';

import {
  DiscoverGroup,
  Group,
  GroupService,
  GroupsRefreshService,
  Post,
  PostService,
} from 'core';

import { GroupsSegment, GroupsSegments, MIN_SEARCH_LENGTH } from './groups.filters';

const PAGE_SIZE = 20;

/**
 * How long an unforced re-entry leaves what is on screen alone. Same window
 * and same reasoning as the Clients tab: stepping into a group and straight
 * back out re-fired three lists for data seconds old.
 */
const FRESH_MS = 15_000;

/** `done` fires on every exit so a refresher spinner can never hang. */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for the Groups hub — three lists from three sources.
 *
 * Feed is an aggregated post stream across every group you are in. Discover
 * is the public directory, which the API already filters to groups you are
 * not in and that are not invite-only. Mine is your memberships, unpaged,
 * and the only one of the three that is a plain array rather than a page.
 *
 * Only the segment on screen loads on entry: unlike Clients, where two
 * lenses answer the same question and switching had to be instant, these
 * are three different requests and pre-fetching all of them on a tab that
 * may only ever show the feed is waste.
 */
@Injectable()
export class GroupsStore {
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // Joining, leaving or creating a group changes all three lenses. The
    // timestamps go so the next `reenter()` actually refetches rather than
    // deciding the seconds-old data it already has is still good.
    this._groupsRefresh.refresh$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._feedFetchedAt = 0;
        this._discoverFetchedAt = 0;
        this._mineFetchedAt = 0;
        this._feedLoaded.set(false);
        this._discoverLoaded.set(false);
        this._mineLoaded.set(false);
      });
  }

  readonly segment = signal<GroupsSegment>(GroupsSegments.Feed);

  /** The Discover search. Only that segment has one. */
  readonly query = signal('');

  /** What the last Discover response actually searched for. */
  private readonly _appliedQuery = signal('');

  // ── Feed ───────────────────────────────────────────────────────────────
  private readonly _feed = signal<Post[]>([]);
  private readonly _feedTotal = signal(0);
  private readonly _feedPage = signal(1);
  private readonly _feedLoading = signal(false);
  private readonly _feedError = signal(false);
  private readonly _feedLoaded = signal(false);
  private _feedFetchedAt = 0;

  // ── Discover ───────────────────────────────────────────────────────────
  private readonly _discover = signal<DiscoverGroup[]>([]);
  private readonly _discoverTotal = signal(0);
  private readonly _discoverPage = signal(1);
  private readonly _discoverLoading = signal(false);
  private readonly _discoverError = signal(false);
  private readonly _discoverLoaded = signal(false);
  private _discoverFetchedAt = 0;
  /**
   * A new term starts a page-1 request while an older one may still be in
   * flight. Responses carry the sequence they were asked under, so a slow
   * answer for an abandoned term can never land as the last word.
   */
  private _discoverSeq = 0;

  // ── Mine ───────────────────────────────────────────────────────────────
  private readonly _mine = signal<Group[]>([]);
  private readonly _mineLoading = signal(false);
  private readonly _mineError = signal(false);
  private readonly _mineLoaded = signal(false);
  private _mineFetchedAt = 0;

  readonly feed = this._feed.asReadonly();
  readonly discover = this._discover.asReadonly();
  readonly mine = this._mine.asReadonly();

  readonly feedHasMore = computed(() => this._feed().length < this._feedTotal());
  readonly discoverHasMore = computed(() => this._discover().length < this._discoverTotal());

  /** How many groups the viewer belongs to. Drives the feed's empty state. */
  readonly myGroupCount = computed(() => this._mine().length);

  /**
   * The term the API is asked to search on — nothing, below the floor. A
   * one-character term is a request per keystroke for a result nobody can
   * read; those rows narrow in memory instead.
   */
  private readonly _serverQuery = computed(() => {
    const term = this.query().trim();
    return term.length >= MIN_SEARCH_LENGTH ? term : '';
  });

  readonly queryTooShort = computed(() => {
    const term = this.query().trim();
    return term.length > 0 && term.length < MIN_SEARCH_LENGTH;
  });

  readonly searchSettled = computed(() => this._serverQuery() === this._appliedQuery());

  private readonly _isFeed = computed(() => this.segment() === GroupsSegments.Feed);
  private readonly _isDiscover = computed(() => this.segment() === GroupsSegments.Discover);

  /** First load of the segment on screen, with nothing under it yet. */
  readonly showSkeleton = computed(() => {
    if (this._isFeed()) return this._feedLoading() && this._feed().length === 0;
    if (this._isDiscover()) return this._discoverLoading() && this._discover().length === 0;
    return this._mineLoading() && this._mine().length === 0;
  });

  /** The load failed and there is nothing to show instead. */
  readonly showLoadError = computed(() => {
    if (this._isFeed()) return this._feedError() && this._feed().length === 0;
    if (this._isDiscover()) return this._discoverError() && this._discover().length === 0;
    return this._mineError() && this._mine().length === 0;
  });

  /**
   * The last load failed but older rows are still under it. Keeping them is
   * right; letting them pass for current is not, so the page says so inline
   * with a retry rather than raising a toast that is gone before it is read.
   */
  readonly isStale = computed(() => {
    if (this._isFeed()) return this._feedError() && this._feed().length > 0;
    if (this._isDiscover()) return this._discoverError() && this._discover().length > 0;
    return this._mineError() && this._mine().length > 0;
  });

  /** Loaded, and genuinely nothing there. */
  readonly isEmpty = computed(() => {
    if (this._isFeed()) return this._feedLoaded() && this._feed().length === 0;
    if (this._isDiscover()) return this._discoverLoaded() && this._discover().length === 0;
    return this._mineLoaded() && this._mine().length === 0;
  });

  /**
   * A Discover search hid everything, but the directory is not empty.
   *
   * Keyed on the term that was actually *sent*, not the one typed: below the
   * search floor no request has run, and reading the raw query here put
   * "No public group matches that" on screen under a hint still asking for a
   * second character — claiming a search that never happened.
   */
  readonly isFilteredEmpty = computed(
    () => this._isDiscover() && !!this._serverQuery() && this.isEmpty(),
  );

  /** Load whichever segment is on screen. */
  load(opts: LoadOptions = {}): void {
    if (this._isFeed()) {
      this.loadFeed(opts);
      // The feed's empty state asks "have you joined anything?", which only
      // the memberships answer — and the answer decides whether the coach
      // is offered "Create your first group" or "Discover groups".
      this.loadMine();
      return;
    }
    if (this._isDiscover()) {
      this.loadDiscover(opts);
      return;
    }
    this.loadMine(opts);
  }

  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  /**
   * Entering the tab. Ionic keeps this page alive in its stack, so a group
   * joined or left elsewhere still has to be picked up — but anything
   * younger than `FRESH_MS` is left alone. Pull-to-refresh and the verbs
   * that just changed something go through `refresh()` and are never held.
   */
  reenter(): void {
    const fetchedAt = this._isFeed()
      ? this._feedFetchedAt
      : this._isDiscover()
        ? this._discoverFetchedAt
        : this._mineFetchedAt;
    if (fetchedAt > 0 && Date.now() - fetchedAt < FRESH_MS) return;
    this.refresh();
  }

  setSegment(segment: GroupsSegment): void {
    if (segment === this.segment()) return;
    this.segment.set(segment);
    // Fills a gap an earlier error left, or a first visit to this lens.
    this.load();
  }

  /**
   * A new Discover term. Debounced by the page, because every call is a
   * request; the rows reset so page 2 of the old term cannot append onto
   * page 1 of the new one.
   */
  setQuery(value: string): void {
    if (value === this.query()) return;
    const previous = this._serverQuery();
    this.query.set(value);

    // The API's answer would be the one it already gave — a third character
    // on a term it has, or a first one it still cannot use.
    if (this._serverQuery() === previous) return;

    this._resetDiscover();
    this.loadDiscover({ force: true });
  }

  clearQuery(): void {
    if (!this.query()) return;
    const hadServerQuery = !!this._serverQuery();
    this.query.set('');
    if (!hadServerQuery) return;
    this._resetDiscover();
    this.loadDiscover({ force: true });
  }

  // ── Loaders ────────────────────────────────────────────────────────────

  loadFeed(opts: LoadOptions = {}): void {
    if (!opts.force && (this._feedLoading() || this._feedLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchFeed(1, opts.done);
  }

  loadMoreFeed(done?: (error?: unknown) => void): void {
    if (this._feedLoading() || !this.feedHasMore()) {
      done?.();
      return;
    }
    this._fetchFeed(this._feedPage() + 1, done);
  }

  loadDiscover(opts: LoadOptions = {}): void {
    if (!opts.force && (this._discoverLoading() || this._discoverLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchDiscover(1, opts.done);
  }

  loadMoreDiscover(done?: (error?: unknown) => void): void {
    if (this._discoverLoading() || !this.discoverHasMore()) {
      done?.();
      return;
    }
    this._fetchDiscover(this._discoverPage() + 1, done);
  }

  loadMine(opts: LoadOptions = {}): void {
    if (!opts.force && (this._mineLoading() || this._mineLoaded())) {
      opts.done?.();
      return;
    }
    this._mineLoading.set(true);
    this._mineError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    this._groupService
      .getMyGroups()
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (groups) => {
          this._mine.set(groups);
          this._mineLoaded.set(true);
          this._mineLoading.set(false);
          this._mineFetchedAt = Date.now();
          opts.done?.();
        },
        error: (error: unknown) => {
          this._mineError.set(true);
          this._mineLoading.set(false);
          opts.done?.(error);
        },
      });
  }

  /**
   * After joining, leaving, creating or deleting. Every list is potentially
   * wrong: Discover drops a group you just joined, Mine gains it, and the
   * feed gains its posts.
   */
  invalidateAll(): void {
    this._feedLoaded.set(false);
    this._discoverLoaded.set(false);
    this._mineLoaded.set(false);
    this.load({ force: true });
  }

  private _resetDiscover(): void {
    this._discover.set([]);
    this._discoverTotal.set(0);
    this._discoverPage.set(1);
    this._discoverLoaded.set(false);
  }

  private _fetchFeed(page: number, done?: (error?: unknown) => void): void {
    this._feedLoading.set(true);
    this._feedError.set(false);

    this._postService
      .getFeed(page, PAGE_SIZE)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          this._feed.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._feedTotal.set(response.total);
          this._feedPage.set(page);
          this._feedLoaded.set(true);
          this._feedLoading.set(false);
          this._feedFetchedAt = Date.now();
          done?.();
        },
        error: (error: unknown) => {
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._feedError.set(true);
          this._feedLoading.set(false);
          done?.(error);
        },
      });
  }

  private _fetchDiscover(page: number, done?: (error?: unknown) => void): void {
    const seq = ++this._discoverSeq;
    const search = this._serverQuery();
    this._discoverLoading.set(true);
    this._discoverError.set(false);

    this._groupService
      .discoverGroups({ search: search || undefined, page, limit: PAGE_SIZE })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          if (seq !== this._discoverSeq) {
            done?.();
            return;
          }
          this._discover.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._discoverTotal.set(response.total);
          this._discoverPage.set(page);
          this._appliedQuery.set(search);
          this._discoverLoaded.set(true);
          this._discoverLoading.set(false);
          this._discoverFetchedAt = Date.now();
          done?.();
        },
        error: (error: unknown) => {
          if (seq !== this._discoverSeq) {
            done?.();
            return;
          }
          if (page === 1) this._discoverError.set(true);
          this._discoverLoading.set(false);
          done?.(error);
        },
      });
  }
}
