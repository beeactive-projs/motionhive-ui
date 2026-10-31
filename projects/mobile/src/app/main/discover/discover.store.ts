import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { DiscoverGroup, GroupService, InstructorSearchResult, ProfileService } from 'core';

/**
 * The coach directory behind Discover: the "Taking new clients" strip and
 * the pushed all-coaches page. Page-scoped (`providers: [DiscoverCoachesStore]`)
 * so each surface owns its instance and refetch policy.
 *
 * The endpoint returns the whole directory as one plain array — no paging,
 * no total — so a `loaded` gate plus client-side filtering is the entire
 * strategy.
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

  /** The strip's list: only coaches with the door open. API order, not a
      ranking: no ranking exists and the strip must not imply one. */
  readonly acceptingCoaches = computed(() =>
    this._coaches().filter((coach) => coach.isAcceptingClients),
  );

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

/** How many groups the strip shows before "All groups" takes over. */
const GROUP_STRIP_LIMIT = 8;

/**
 * Public groups the reader is not in yet: Discover's "Groups to join" strip
 * (one short page) and the all-groups list (paged, `usePageSize`). The
 * endpoint already leaves out groups the reader is in, so everything here is
 * somewhere they could go. Same load policy as the coaches: once per visit,
 * forced by pull to refresh; a failure does not latch `loaded`, so the next
 * entry retries.
 */
@Injectable()
export class DiscoverGroupsStore {
  private readonly _groupService = inject(GroupService);

  private _pageSize = GROUP_STRIP_LIMIT;

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

  /** Rows per request. The strip keeps the default; a full list asks for more. */
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
