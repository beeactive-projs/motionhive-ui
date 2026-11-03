import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import {
  DiscoverGroup,
  GroupService,
  InstructorSearchResult,
  ProfileService,
  PublicSessionInstance,
  SessionService,
} from 'core';

/**
 * The coaches behind Discover: the coach of the week, "Coaches near you" and
 * search's goals. Page-scoped (`providers: [DiscoverCoachesStore]`) so each
 * surface owns its instance and refetch policy.
 *
 * `/profile/instructors/discover` returns its top 30 as one plain array (no
 * paging, no total), so a `loaded` gate plus client-side filtering is the
 * entire strategy. The full, paged list is the Coaches screen's
 * (`CoachDirectoryStore`).
 */
@Injectable()
export class DiscoverCoachesStore {
  private readonly _profileService = inject(ProfileService);

  private readonly _coaches = signal<InstructorSearchResult[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);

  readonly coaches = this._coaches.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  load(opts: { force?: boolean; done?: () => void } = {}): void {
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

/** One request's worth by default: enough for Discover to filter by city
    and goal on the phone, since the endpoint knows neither. */
const GROUP_PAGE_LIMIT = 50;

/**
 * Public groups the reader is not in yet: Discover's "Groups to join" cards
 * and search's goals (one page) and the all-groups list (paged,
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

/** How many upcoming sessions search's goals look through. */
const UPCOMING_LIMIT = 50;

/**
 * One page of upcoming sessions for search's "Browse by goal", which filters
 * them on the phone (the endpoint has no notion of a goal). Loaded once per
 * visit, the first time a goal is opened; a failure leaves the list empty
 * and lets the next goal try again.
 */
@Injectable()
export class DiscoverUpcomingStore {
  private readonly _sessionService = inject(SessionService);

  private readonly _sessions = signal<PublicSessionInstance[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  readonly sessions = this._sessions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  load(): void {
    if (this._loading() || this._loaded()) return;
    this._loading.set(true);
    this._sessionService
      .discover({ page: 1, limit: UPCOMING_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this._sessions.set(page.items);
          this._loaded.set(true);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      });
  }
}
