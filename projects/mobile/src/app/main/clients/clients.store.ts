import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, take, tap } from 'rxjs';

import {
  ClientService,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
} from 'core';

import { MoreBadgesService } from '../../_shared/services/more-badges.service';
import {
  ClientFilterId,
  ClientFilterIds,
  MIN_SEARCH_LENGTH,
  filterStatus,
  matchesClientQuery,
} from './clients.filters';

const PAGE_SIZE = 20;

/**
 * How long an unforced re-entry leaves what is on screen alone. Long enough
 * to cover stepping into a client and straight back out — which re-fired the
 * list and the request count within a second or two, for data that had no
 * chance to change — and short enough that nothing here is visibly behind.
 * Same shape as `MoreBadgesService`'s own window, which the request count
 * this page refreshes already rides on.
 */
const FRESH_MS = 15_000;

/**
 * `done` carries what went wrong, or nothing when the load settled. A
 * refresher has to stop spinning either way, but only the caller knows
 * whether the failure is worth saying out loud — a background refresh
 * failing quietly is fine, a pull-to-refresh failing quietly is not.
 */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for the coach's Clients tab: one list off `/clients`,
 * every relationship and request, paged, narrowed server-side by a status
 * chip and a search term.
 *
 * Every loader takes `{ force?, done? }` and fires `done` on every exit —
 * success, error, or the dedup early-return — so a refresher spinner can
 * never hang on a load that was never started.
 */
@Injectable()
export class ClientsStore {
  private readonly _clientService = inject(ClientService);
  private readonly _moreBadgesService = inject(MoreBadgesService);
  /**
   * The page's, since the store is provided by it. Every stream below is
   * cancelled with the page: `take(1)` caps how many values arrive but does
   * not stop a slow response landing after the view is gone, writing to
   * signals nobody reads and raising a toast on a screen the coach has left.
   */
  private readonly _destroyRef = inject(DestroyRef);

  readonly filter = signal<ClientFilterId>(ClientFilterIds.All);

  /**
   * The header search. It goes to the API, which searches every client —
   * filtering only the loaded page meant a coach with 100 clients got
   * "Nothing matches" for client #85 until they had scrolled far enough to
   * load them.
   */
  readonly query = signal('');

  /** What the last list response actually searched for. */
  private readonly _appliedQuery = signal('');

  private readonly _clients = signal<InstructorClient[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _listLoading = signal(false);
  private readonly _listError = signal(false);
  private readonly _listLoaded = signal(false);
  /**
   * How many clients the coach has at all, which is what tells the
   * first-time screen apart from a chip that hid everything. Written only
   * when an unfiltered first page lands, so a chip or a search never
   * shrinks it.
   */
  private readonly _allTotal = signal<number | null>(null);

  /**
   * A filter change or a refresh starts a new page-1 request while an older
   * one may still be in flight. Responses carry the sequence they were asked
   * under and anything stale is dropped, so a slow "Active" page can never
   * land in an "Archived" list.
   */
  private _listSeq = 0;

  /** When the list last landed, for the freshness window `reenter()` reads. */
  private _listFetchedAt = 0;

  /**
   * The part of the search the API will act on — nothing, below its floor.
   *
   * The API ignores a term under `MIN_SEARCH_LENGTH` and answers with the
   * unfiltered page, which is indistinguishable from a page of matches. A
   * single `a` therefore came back as the whole directory, "Test User" and
   * all, under a search box reading `a`. Holding the term back is the fix:
   * an unsearched request is at least honestly unsearched, and the rows are
   * narrowed in memory instead.
   */
  private readonly _serverQuery = computed(() => {
    const term = this.query().trim();
    return term.length >= MIN_SEARCH_LENGTH ? term : '';
  });

  /** Typed, but not yet enough for the API to search on. Said under the field. */
  readonly queryTooShort = computed(() => {
    const term = this.query().trim();
    return term.length > 0 && term.length < MIN_SEARCH_LENGTH;
  });

  /**
   * The rows on screen. The API has already applied whatever it could search
   * on, so this re-filters while a newly typed term is still in flight —
   * without it the previous result set would sit there looking like a match —
   * and permanently for a term below the floor, which the API ignored.
   */
  readonly visibleClients = computed(() => {
    const query = this.query().trim();
    const clients = this._clients();
    if (!query || query === this._appliedQuery()) return clients;
    return clients.filter((client) => matchesClientQuery(client, query));
  });

  readonly hasMore = computed(() => this._clients().length < this._total());

  readonly showSkeleton = computed(() => this._listLoading() && this._clients().length === 0);

  readonly showLoadError = computed(() => this._listError() && this._clients().length === 0);

  /**
   * The first-time screen: no relationships, no requests, nothing at all.
   * Known only once an unfiltered page has landed, and it survives a chip
   * change because `_allTotal` does.
   */
  readonly isEmpty = computed(() => this._allTotal() === 0);

  /** A chip or the search hid everything, but the coach does have clients. */
  readonly isFilteredEmpty = computed(
    () =>
      !this.isEmpty() &&
      this._listLoaded() &&
      !this._listLoading() &&
      !this._listError() &&
      this.visibleClients().length === 0,
  );

  /**
   * The rows below are the answer to what is in the box — nothing is still
   * on its way. Read by the page to decide when a result count is worth
   * announcing: saying "3 clients" over a list about to be replaced is worse
   * than saying nothing.
   */
  readonly searchSettled = computed(() => this._serverQuery() === this._appliedQuery());

  /**
   * The last load failed, but there are rows from an earlier one still
   * under it.
   *
   * Keeping stale rows is right; letting them pass for current is not. This
   * bar is the only thing that says so: entering the tab refreshes too, and a
   * failure there needs something that stays put and offers the retry, not a
   * toast that is gone before it is read.
   */
  readonly isStale = computed(() => this._listError() && this._clients().length > 0);

  /**
   * Load the list and the requests count. `done` fires when the list
   * settles; the count only feeds the Clients tab's dot and must not hold a
   * refresher spinner.
   */
  load(opts: LoadOptions = {}): void {
    this.loadList({ force: opts.force, done: opts.done });
    this.loadPendingCount();
  }

  /**
   * Quietly by construction: the skeleton only shows over an empty list, and
   * a failure here raises the stale bar rather than anything transient. The
   * callback only has to stop a refresher spinning.
   */
  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  /**
   * Entering the tab. Ionic keeps this page alive in the stack, so an invite
   * accepted or a client archived elsewhere still has to be picked up — but
   * stepping into a client and straight back out re-fired the list and the
   * count for data seconds old. Anything younger than `FRESH_MS` is left
   * alone; pull-to-refresh and the verbs that just changed something go
   * through `refresh()` and are never held back.
   */
  reenter(): void {
    if (this._listFetchedAt > 0 && Date.now() - this._listFetchedAt < FRESH_MS) return;
    this.refresh();
  }

  /** Page 1 for the current chip. `force` restarts even mid-flight. */
  loadList(opts: LoadOptions = {}): void {
    if (!opts.force && (this._listLoading() || this._listLoaded())) {
      opts.done?.();
      return;
    }
    this._fetchPage(1, opts.done);
  }

  /** Infinite scroll — appends the next page. */
  loadMore(done?: (error?: unknown) => void): void {
    if (this._listLoading() || !this.hasMore()) {
      done?.();
      return;
    }
    this._fetchPage(this._page() + 1, done);
  }

  setFilter(id: ClientFilterId): void {
    if (id === this.filter()) return;
    this.filter.set(id);
    this._resetList();
    this.loadList({ force: true });
  }

  /**
   * A new search term. Debounced by the page, because every call is a
   * request now; the rows reset so page 2 of the old term cannot append
   * onto page 1 of the new one.
   */
  setQuery(value: string): void {
    if (value === this.query()) return;
    const previous = this._serverQuery();
    this.query.set(value);

    // The API's answer would be the same one it already gave — a third
    // character on a term it has, or a first one it still cannot use. The
    // rows on screen re-narrow in memory; there is nothing to fetch.
    if (this._serverQuery() === previous) return;

    this._resetList();
    this.loadList({ force: true });
  }

  private _resetList(): void {
    this._clients.set([]);
    this._total.set(0);
    this._page.set(1);
    this._listLoaded.set(false);
  }

  clearFilters(): void {
    const hadServerQuery = !!this._serverQuery();
    this.query.set('');
    // The chip first: `setFilter` resets the rows and reloads for the cleared
    // term as well, so going through it is the one request that covers both.
    if (this.filter() !== ClientFilterIds.All) {
      this.setFilter(ClientFilterIds.All);
      return;
    }
    // `setFilter` early-returns when the chip is already All, so the cleared
    // search would never reach the API without this. A term the API never saw
    // needs no round trip: those rows are the unfiltered page already, and
    // only the in-memory narrowing has to drop away.
    if (!hadServerQuery) return;
    this._resetList();
    this.loadList({ force: true });
  }

  /**
   * Counts feed a dot, not layout — the service swallows a failure. Unforced
   * on entry, so it joins the tab shell's request instead of racing it;
   * `force` is for the verbs below that just changed the number.
   */
  loadPendingCount(force = false): void {
    this._moreBadgesService.refreshPendingRequests(force);
  }

  /** A new invitation is a new PENDING row and one more request in flight. */
  onInviteSent(): void {
    this.loadList({ force: true });
    this.loadPendingCount(true);
  }

  // ── Mutations ────────────────────────────────────────────────────────────
  // Each takes the whole row so the call site cannot pick the wrong id: the
  // relationship verbs key on `clientId` (the person), the request verbs on
  // `id` (the request). The row is patched the moment the call lands.

  archive(client: InstructorClient): Observable<InstructorClient> {
    return this._clientService.archiveClient(client.clientId).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap((updated) => this._settle(client.id, updated, InstructorClientStatuses.Active)),
    );
  }

  unarchive(client: InstructorClient): Observable<InstructorClient> {
    return this._clientService.unarchiveClient(client.clientId).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap((updated) => this._settle(client.id, updated, InstructorClientStatuses.Archived)),
    );
  }

  /** Withdraw an invitation the coach sent. Only the sender may. */
  withdraw(client: InstructorClient): Observable<unknown> {
    return this._clientService.cancelRequest(client.id).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() => this._dropRequest(client)),
    );
  }

  /** Turn down a request sent to the coach. The row goes, like a withdrawn one. */
  decline(client: InstructorClient): Observable<unknown> {
    return this._clientService.declineRequest(client.id).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() => this._dropRequest(client)),
    );
  }

  /**
   * Say yes to a request. The request row becomes a relationship with a new
   * id and a profile, which only the API can hand back, so the list reloads
   * rather than patching.
   */
  accept(client: InstructorClient): Observable<unknown> {
    return this._clientService.acceptRequest(client.id).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() => {
        this.loadList({ force: true });
        this.loadPendingCount(true);
      }),
    );
  }

  /** The row stays; only its expiry moves out. */
  resend(client: InstructorClient): Observable<unknown> {
    return this._clientService.resendInvitation(client.id).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap((response) => {
        const expiresAt = response.request?.expiresAt;
        if (!expiresAt) return;
        this._clients.update((rows) =>
          rows.map((row) => (row.id === client.id ? { ...row, expiresAt } : row)),
        );
      }),
    );
  }

  updateNotes(client: InstructorClient, notes: string): Observable<InstructorClient> {
    return this._clientService.updateClient(client.clientId, { notes }).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap((updated) => this._patch(client.id, updated)),
    );
  }

  /**
   * Apply a status change. Under a chip that only shows the status it just
   * left, the row leaves the list; under any other it stays and re-labels.
   */
  private _settle(
    rowId: string,
    updated: InstructorClient,
    leaving: InstructorClientStatus,
  ): void {
    if (filterStatus(this.filter()) === leaving) {
      this._clients.update((rows) => rows.filter((row) => row.id !== rowId));
      this._total.update((total) => Math.max(0, total - 1));
      return;
    }
    this._patch(rowId, updated);
  }

  /**
   * A request that no longer exists, withdrawn or declined. It is gone from
   * the list, not merely out of this chip's reach the way an archived row
   * is, so the client count moves too, or dropping the last one would never
   * reach the first-time screen.
   */
  private _dropRequest(client: InstructorClient): void {
    this._clients.update((rows) => rows.filter((row) => row.id !== client.id));
    this._total.update((total) => Math.max(0, total - 1));
    this._allTotal.update((total) => (total === null ? null : Math.max(0, total - 1)));
    this.loadPendingCount(true);
  }

  /** Merge only what the verb changed — the response may omit the nested user. */
  private _patch(rowId: string, updated: InstructorClient): void {
    this._clients.update((rows) =>
      rows.map((row) =>
        row.id === rowId
          ? { ...row, status: updated.status, notes: updated.notes, startedAt: updated.startedAt }
          : row,
      ),
    );
  }

  private _fetchPage(page: number, done?: (error?: unknown) => void): void {
    const seq = ++this._listSeq;
    const status = filterStatus(this.filter());
    const search = this._serverQuery();
    this._listLoading.set(true);
    this._listError.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry, and a modal on top of that is the same failure told twice.
    this._clientService
      .getClients({ status, search, page, limit: PAGE_SIZE }, { silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          if (seq !== this._listSeq) {
            done?.();
            return;
          }
          this._clients.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this._total.set(response.total);
          this._page.set(page);
          this._appliedQuery.set(search);
          this._listFetchedAt = Date.now();
          // Only an unfiltered page can speak for every client — a searched
          // total would make the first-time screen show for a search miss.
          if (status === undefined && !search) this._allTotal.set(response.total);
          this._listLoaded.set(true);
          this._listLoading.set(false);
          done?.();
        },
        error: (error: unknown) => {
          if (seq !== this._listSeq) {
            done?.();
            return;
          }
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._listError.set(true);
          this._listLoading.set(false);
          done?.(error);
        },
      });
  }
}
