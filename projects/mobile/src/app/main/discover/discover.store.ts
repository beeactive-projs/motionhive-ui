import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, map, take } from 'rxjs';

import {
  CategoryStore,
  DiscoverGroup,
  GroupService,
  InstructorSearchResult,
  ProfileService,
  PublicSessionInstance,
  SessionLocationKind,
  SessionService,
  withCategorySpecialties,
} from 'core';

import { DiscoverTopic, topicCategoryIds } from './discover.config';

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

/**
 * The coaches behind Discover: the spotlight, "Coaches near you" and
 * search's topics. Page-scoped (`providers: [DiscoverCoachesStore]`) so each
 * surface owns its instance and refetch policy.
 *
 * `/profile/instructors/discover` returns its top 30 as one plain array (no
 * paging, no total): `coaches` is that list (the tab's city list, chips and
 * Online), and `topicCoaches` the same endpoint narrowed to a topic's
 * categories on the server. The full, paged list is the Coaches screen's
 * (`CoachDirectoryStore`).
 */
@Injectable()
export class DiscoverCoachesStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _categoryStore = inject(CategoryStore);

  private readonly _coaches = signal<InstructorSearchResult[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);

  /**
   * Each line under a coach's name reads their specializations; a coach who
   * picked categories and wrote none shows the categories' names there.
   */
  readonly coaches = computed(() => {
    const byId = this._categoryStore.byId();
    return this._coaches().map((coach) => withCategorySpecialties(coach, byId));
  });
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** The coaches of the topic's categories, from the API (`useTopic`), mapped like `coaches`. */
  private readonly _topic = new TopicList<InstructorSearchResult>();
  readonly topicCoaches = computed(() => {
    const byId = this._categoryStore.byId();
    return this._topic.items().map((coach) => withCategorySpecialties(coach, byId));
  });
  readonly topicLoading = this._topic.loading;
  readonly topicLoaded = this._topic.loaded;
  readonly topicError = this._topic.error;

  /**
   * Narrow `topicCoaches` to any of these categories, on the server, so a
   * coach past the top 30 is not missed; null for no topic.
   */
  useTopic(categoryIds: readonly string[] | null): void {
    this._topic.use(categoriesKey(categoryIds), () =>
      this._profileService.discoverInstructors({ categoryIds: categoryIds ?? [] }),
    );
  }

  /** Pull to refresh for the topic's coaches. */
  refreshTopic(done?: () => void): void {
    this._topic.refresh(done);
  }

  load(opts: { force?: boolean; done?: () => void } = {}): void {
    this._categoryStore.ensureLoaded();
    if (this._loading() || (this._loaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);

    this._profileService
      .discoverInstructors()
      .pipe(take(1))
      .subscribe({
        next: (coaches) => {
          this._coaches.set(coaches);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        // A failed load does not latch `loaded`, so the next view entry retries.
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }
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

  /** The groups of the topic's categories, from the API (`useTopic`). */
  private readonly _topic = new TopicList<DiscoverGroup>();
  readonly topicGroups = this._topic.items;
  readonly topicLoading = this._topic.loading;
  readonly topicLoaded = this._topic.loaded;
  readonly topicError = this._topic.error;

  /**
   * Narrow `topicGroups` to any of these categories, on the server, so a
   * group past the first page is not missed; null for no topic.
   */
  useTopic(categoryIds: readonly string[] | null): void {
    this._topic.use(categoriesKey(categoryIds), () =>
      this._groupService
        .discoverGroups({ categoryIds: categoryIds ?? [], page: 1, limit: GROUP_PAGE_LIMIT })
        .pipe(map((page) => page.items)),
    );
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
