import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, map, of, switchMap, take } from 'rxjs';

import {
  CategoryStore,
  CoachDirectoryFacets,
  CoachDirectoryParams,
  CoachDirectorySorts,
  DiscoverGroup,
  DiscoverGroupsQuery,
  GroupService,
  InstructorSearchResult,
  ProfileService,
  PublicSessionInstance,
  SessionLocationKind,
  SessionService,
  withCategorySpecialties,
} from 'core';

import { DiscoverTopic, SPOTLIGHT_LIMIT, topicCategoryIds } from './discover.config';

/**
 * One list the API narrows to a topic, kept beside a store's own list: the
 * latest topic asked for wins, an answer for an earlier one is dropped, and
 * no topic holds nothing. A refresh asks again for the same topic and keeps
 * the rows on screen until the answer replaces them.
 */
export class TopicList<T> {
  private readonly _items = signal<T[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  private _key: string | null = null;
  private _fetch: (() => Observable<T[]>) | null = null;
  private _subscription: Subscription | null = null;

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  /** The list for `key` (null for none), fetched unless it is the one already asked for. */
  use(key: string | null, fetch: () => Observable<T[]>): void {
    if (key === this._key) {
      return;
    }
    this._key = key;
    this._fetch = fetch;
    this._items.set([]);
    this._loaded.set(false);
    this._run();
  }

  /** The same topic again (pull to refresh); `done` runs once it settles. */
  refresh(done?: () => void): void {
    this._run(done);
  }

  private _run(done?: () => void): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
    const fetch = this._fetch;
    if (this._key === null || !fetch) {
      this._loading.set(false);
      this._error.set(false);
      done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);
    this._subscription = fetch()
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          this._items.set(items);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          done?.();
        },
      });
  }
}

/** One key per set of categories, whatever their order. */
function categoriesKey(categoryIds: readonly string[] | null): string | null {
  if (!categoryIds) {
    return null;
  }
  return [...categoryIds].sort().join(',');
}

/** What Discover asks the directory for: a city (online coaches count in it) and a topic. */
export interface DiscoverCoachQuery {
  /** The city Discover shows, as people write it; null for everywhere. */
  city: string | null;
  /** The topic's categories; null for none. */
  categoryIds: readonly string[] | null;
  /** The Online topic: coaches with an online place. */
  online: boolean;
}

/** Coaches for a city, or for every city when that one has nobody. */
export interface CoachPick {
  coaches: InstructorSearchResult[];
  /** The city had nobody, so these are every city's. */
  everywhere: boolean;
  /** How many there are in all for what was asked. */
  total: number;
}

const NO_PICK: CoachPick = { coaches: [], everywhere: false, total: 0 };

/** A topic's coaches on the search screen, the most relevant first. */
const TOPIC_COACH_LIMIT = 30;

/**
 * One value fetched for a key: the latest key asked for wins, an answer for
 * an earlier one is dropped, and a refresh asks again for the same key while
 * the value on screen stays until the answer replaces it.
 */
class KeyedValue<T> {
  private readonly _value: WritableSignal<T>;
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  private _key: string | null = null;
  private _fetch: (() => Observable<T>) | null = null;
  private _subscription: Subscription | null = null;

  constructor(private readonly _empty: T) {
    this._value = signal<T>(_empty);
  }

  readonly value = computed(() => this._value());
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  use(key: string, fetch: () => Observable<T>): void {
    if (key === this._key) {
      return;
    }
    this._key = key;
    this._fetch = fetch;
    this._value.set(this._empty);
    this._loaded.set(false);
    this._run();
  }

  refresh(done?: () => void): void {
    this._run(done);
  }

  private _run(done?: () => void): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
    const fetch = this._fetch;
    if (!fetch) {
      done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);
    this._subscription = fetch()
      .pipe(take(1))
      .subscribe({
        next: (value) => {
          this._value.set(value);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          done?.();
        },
      });
  }
}

/**
 * The coaches behind Discover and its search, all from the paged directory
 * (`/profile/instructors/directory`), which already leaves out the reader,
 * anyone on either side of a block and accounts that no longer coach. Every
 * filter is the server's, over every coach, so nobody past a first page is
 * missed. Page-scoped (`providers: [DiscoverCoachesStore]`): each surface
 * owns its instance.
 *
 * - `facets`: the cities coaches are in, the categories they coach and how
 *   many coach online, over the whole directory: the tab's city list and
 *   chips.
 * - `spotlight`: today's few coaches taking clients for the city and topic
 *   (the server's `spotlight` order turns every day, the same for
 *   everyone), every city's when the city has nobody. Promoted coaches will
 *   be a pool of their own through the same carousel.
 * - `near`: the city's coaches for the topic, the most relevant to the
 *   reader first (`recommended`), every city's when the city has nobody:
 *   who stands in for the spotlight when nobody takes clients.
 * - `topicCoaches`: the search screen's coaches for a browse card.
 */
@Injectable()
export class DiscoverCoachesStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _categoryStore = inject(CategoryStore);

  private readonly _facets = signal<CoachDirectoryFacets>(NO_FACETS);
  private readonly _facetsLoading = signal(false);
  private readonly _facetsLoaded = signal(false);
  private readonly _facetsError = signal(false);

  readonly facets = this._facets.asReadonly();
  readonly loaded = this._facetsLoaded.asReadonly();
  readonly error = this._facetsError.asReadonly();
  readonly loading = this._facetsLoading.asReadonly();

  private readonly _spotlight = new KeyedValue<CoachPick>(NO_PICK);
  private readonly _near = new KeyedValue<CoachPick>(NO_PICK);
  private readonly _topic = new KeyedValue<InstructorSearchResult[]>([]);

  /** Each line under a coach's name reads their words, else their categories' names. */
  readonly spotlight = computed(() => this._mapPick(this._spotlight.value()));
  readonly near = computed(() => this._mapPick(this._near.value()));
  readonly topicCoaches = computed(() => {
    const byId = this._categoryStore.byId();
    return this._topic.value().map((coach) => withCategorySpecialties(coach, byId));
  });

  /** The tab's coach sections have their first answer for the query on screen. */
  readonly sectionsLoaded = computed(() => this._spotlight.loaded() && this._near.loaded());
  readonly sectionsLoading = computed(() => this._spotlight.loading() || this._near.loading());
  readonly sectionsError = computed(() => this._spotlight.error() && this._near.error());

  readonly topicLoading = this._topic.loading;
  readonly topicLoaded = this._topic.loaded;
  readonly topicError = this._topic.error;

  /** The facets, once per visit; `force` on pull to refresh. */
  load(opts: { force?: boolean; done?: () => void } = {}): void {
    this._categoryStore.ensureLoaded();
    if (this._facetsLoading() || (this._facetsLoaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._facetsLoading.set(true);
    this._facetsError.set(false);
    this._profileService
      .coachDirectoryFacets({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (facets) => {
          this._facets.set(facets);
          this._facetsLoaded.set(true);
          this._facetsLoading.set(false);
          opts.done?.();
        },
        // A failed load does not latch `loaded`, so the next view entry retries.
        error: () => {
          this._facetsError.set(true);
          this._facetsLoading.set(false);
          opts.done?.();
        },
      });
  }

  /** The tab's coach sections for this city and topic, each asked once per query. */
  useQuery(query: DiscoverCoachQuery): void {
    const key = queryKey(query);
    this._spotlight.use(key, () =>
      this._pick(query, {
        sort: CoachDirectorySorts.Spotlight,
        accepting: true,
        limit: SPOTLIGHT_LIMIT,
      }),
    );
    // Who stands in for the spotlight when nobody takes clients.
    this._near.use(key, () =>
      this._pick(query, {
        sort: CoachDirectorySorts.Recommended,
        limit: SPOTLIGHT_LIMIT,
      }),
    );
  }

  /** The search screen's coaches for a browse card; null for none. */
  useTopic(topic: { categoryIds: readonly string[] | null; online: boolean } | null): void {
    if (!topic) {
      return;
    }
    const query = { city: null, ...topic };
    this._topic.use(queryKey(query), () =>
      this._profileService
        .coachDirectory(
          {
            ...topicParams(query),
            sort: CoachDirectorySorts.Recommended,
            limit: TOPIC_COACH_LIMIT,
          },
          { silent: true },
        )
        .pipe(map((page) => page.items)),
    );
  }

  /** Pull to refresh: the facets and whatever the tab shows. */
  refresh(done?: () => void): void {
    this.load({ force: true });
    this._spotlight.refresh();
    this._near.refresh(done);
  }

  refreshTopic(done?: () => void): void {
    this._topic.refresh(done);
  }

  /**
   * The city's coaches (online ones included), or every city's when it has
   * nobody for this topic: Discover never shows an empty coach section
   * while somebody coaches it somewhere.
   */
  private _pick(query: DiscoverCoachQuery, base: CoachDirectoryParams): Observable<CoachPick> {
    const params: CoachDirectoryParams = { ...base, ...topicParams(query) };
    const everywhere = this._profileService.coachDirectory(params, { silent: true }).pipe(
      map((page) => ({ coaches: page.items, everywhere: !!query.city, total: page.total })),
    );
    if (!query.city) {
      return everywhere.pipe(map((pick) => ({ ...pick, everywhere: false })));
    }
    return this._profileService
      .coachDirectory({ ...params, city: query.city, includeOnline: true }, { silent: true })
      .pipe(
        switchMap((page) => {
          if (page.total > 0) {
            return of({ coaches: page.items, everywhere: false, total: page.total });
          }
          return everywhere;
        }),
      );
  }

  private _mapPick(pick: CoachPick): CoachPick {
    const byId = this._categoryStore.byId();
    return {
      ...pick,
      coaches: pick.coaches.map((coach) => withCategorySpecialties(coach, byId)),
    };
  }
}

const NO_FACETS: CoachDirectoryFacets = {
  cities: [],
  specializations: [],
  categories: [],
  online: 0,
};

/** The directory params a topic narrows to: its categories, or online coaches. */
function topicParams(query: DiscoverCoachQuery): CoachDirectoryParams {
  const params: CoachDirectoryParams = {};
  if (query.categoryIds && query.categoryIds.length > 0) {
    params.categoryIds = query.categoryIds;
  }
  if (query.online) {
    params.online = true;
  }
  return params;
}

/** One key per query, whatever the order of its categories. */
function queryKey(query: DiscoverCoachQuery): string {
  const categories = categoriesKey(query.categoryIds) ?? '';
  return `${query.city ?? ''}|${categories}|${query.online ? 'online' : ''}`;
}

/** One request's worth by default: Discover's cards, its city list and its
    chips are read from it (a topic's own groups come from `useTopic`). */
const GROUP_PAGE_LIMIT = 50;

/**
 * Public groups the reader is not in yet: Discover's "Groups to join" cards
 * and search's topics (one page) and the all-groups list (paged,
 * `usePageSize`). The
 * endpoint already leaves out groups the reader is in, so everything here is
 * somewhere they could go. Same load policy as the coaches: once per visit,
 * forced by pull to refresh; a failure does not latch `loaded`, so the next
 * entry retries.
 */
@Injectable()
export class DiscoverGroupsStore {
  private readonly _groupService = inject(GroupService);

  private _pageSize = GROUP_PAGE_LIMIT;

  private readonly _groups = signal<DiscoverGroup[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);

  readonly groups = this._groups.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly hasMore = computed(() => this._groups().length < this._total());

  /** The groups of the topic's categories and the city, from the API (`useTopic`). */
  private readonly _topic = new TopicList<DiscoverGroup>();
  readonly topicGroups = this._topic.items;
  readonly topicLoading = this._topic.loading;
  readonly topicLoaded = this._topic.loaded;
  readonly topicError = this._topic.error;

  /**
   * Narrow `topicGroups` to any of these categories, on the server, so a
   * group past the first page is not missed; null for no topic.
   */
  useTopic(categoryIds: readonly string[] | null, city: string | null = null): void {
    const categories = categoriesKey(categoryIds);
    // Neither: the tab's own read already is that list.
    let key: string | null = null;
    if (categories !== null || city) {
      key = `${city ?? ''}|${categories ?? ''}`;
    }
    this._topic.use(key, () => {
      const query: DiscoverGroupsQuery = {
        categoryIds: categoryIds ?? [],
        page: 1,
        limit: GROUP_PAGE_LIMIT,
      };
      // On the server: the 50 biggest groups filtered on the phone left a
      // Cluj reader with nothing while Cluj groups sat further down.
      if (city) {
        query.city = city;
      }
      return this._groupService.discoverGroups(query).pipe(map((page) => page.items));
    });
  }

  /** Pull to refresh for the topic's groups. */
  refreshTopic(done?: () => void): void {
    this._topic.refresh(done);
  }

  /** Rows per request. Discover keeps the default; the full list pages by fewer. */
  usePageSize(size: number): void {
    this._pageSize = size;
  }

  load(opts: { force?: boolean; done?: () => void } = {}): void {
    if (this._loading() || (this._loaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);

    this._groupService
      .discoverGroups({ page: 1, limit: this._pageSize })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this._groups.set(page.items);
          this._total.set(page.total);
          this._page.set(1);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }

  /** The next page, appended. A failure leaves the rows and lets the next
      scroll try again. */
  loadMore(done: () => void): void {
    if (this._loading() || !this.hasMore()) {
      done();
      return;
    }
    this._loading.set(true);
    const next = this._page() + 1;

    this._groupService
      .discoverGroups({ page: next, limit: this._pageSize })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          const seen = new Set(this._groups().map((group) => group.id));
          this._groups.update((rows) => [
            ...rows,
            ...page.items.filter((group) => !seen.has(group.id)),
          ]);
          this._total.set(page.total);
          this._page.set(next);
          this._loading.set(false);
          done();
        },
        error: () => {
          this._loading.set(false);
          done();
        },
      });
  }
}

/** How many upcoming sessions a search topic shows. */
const UPCOMING_LIMIT = 50;

/**
 * Upcoming sessions for one of search's "Browse by activity" topics, from
 * the API: by the topic's categories, or online ones for Online. Loaded when
 * a topic is opened; a failure leaves the list empty and the next topic, or
 * Try again, asks again.
 */
@Injectable()
export class DiscoverUpcomingStore {
  private readonly _sessionService = inject(SessionService);

  private readonly _topic = new TopicList<PublicSessionInstance>();

  readonly sessions = this._topic.items;
  readonly loading = this._topic.loading;
  readonly loaded = this._topic.loaded;
  readonly error = this._topic.error;

  useTopic(topic: DiscoverTopic | null): void {
    if (!topic) {
      this._topic.use(null, () => this._sessionService.discover().pipe(map((page) => page.items)));
      return;
    }
    const categoryIds = topicCategoryIds(topic);
    let locationKind: SessionLocationKind | undefined;
    if (topic.online) {
      locationKind = SessionLocationKind.Online;
    }
    this._topic.use(`${topic.id}:${categoriesKey(categoryIds) ?? ''}`, () =>
      this._sessionService
        .discover({ categoryIds: categoryIds ?? undefined, locationKind, page: 1, limit: UPCOMING_LIMIT })
        .pipe(map((page) => page.items)),
    );
  }

  /** The same topic again, after a failure. */
  retry(): void {
    this._topic.refresh();
  }
}
