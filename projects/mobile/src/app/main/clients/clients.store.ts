import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, take, tap } from 'rxjs';

import {
  ClientService,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  RosterClient,
  RosterService,
  RosterSummary,
} from 'core';

import { MoreBadgesService } from '../../_shared/services/more-badges.service';
import {
  ClientFilterId,
  ClientFilterIds,
  ClientsSegment,
  ClientsSegments,
  ROSTER_WINDOW,
  filterStatus,
  matchesClientQuery,
  matchesRosterQuery,
} from './clients.config';

const PAGE_SIZE = 20;

/**
 * `done` carries what went wrong, or nothing when the load settled. A
 * refresher has to stop spinning either way, but only the caller knows
 * whether the failure is worth saying out loud — a background lens failing
 * quietly is fine, a pull-to-refresh failing quietly is not.
 */
type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for the coach's Clients tab.
 *
 * Two lenses on the same people, from two sources that cannot be joined
 * server-side: the roster (`/coach/roster`) knows who is slipping and by how
 * much but nothing about invitations; the client list (`/clients`) knows
 * every relationship and request but nothing about training. Needs attention
 * reads the roster, All clients pages through the list, and both load on
 * entry so switching segments never waits.
 *
 * Every loader takes `{ force?, done? }` and fires `done` on every exit —
 * success, error, or the dedup early-return — so a refresher spinner can
 * never hang on a load that was never started.
 */
@Injectable()
export class ClientsStore {
  private readonly _clientService = inject(ClientService);
  private readonly _rosterService = inject(RosterService);
  private readonly _moreBadgesService = inject(MoreBadgesService);

  readonly segment = signal<ClientsSegment>(ClientsSegments.Attention);
  readonly filter = signal<ClientFilterId>(ClientFilterIds.All);

  /**
   * The header search. The directory sends it to the API, which searches
   * the whole roster — filtering only the loaded page meant a coach with
   * 100 clients got "Nothing matches" for client #85 until they had
   * scrolled far enough to load them. The triage still narrows in memory:
   * the roster is one unpaged response and is already all here.
   */
  readonly query = signal('');

  /** What the last list request actually searched for. */
  private readonly _appliedQuery = signal('');

  private readonly _roster = signal<RosterSummary | null>(null);
  private readonly _rosterLoading = signal(false);
  private readonly _rosterError = signal(false);
  private readonly _rosterLoaded = signal(false);

  private readonly _clients = signal<InstructorClient[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _listLoading = signal(false);
  private readonly _listError = signal(false);
  private readonly _listLoaded = signal(false);
  /**
   * Feeds "All clients · N". Written only when an unfiltered first page lands,
   * so a chip filter never shrinks the segment's count.
   */
  private readonly _allTotal = signal<number | null>(null);

  /**
   * A filter change or a refresh starts a new page-1 request while an older
   * one may still be in flight. Responses carry the sequence they were asked
   * under and anything stale is dropped, so a slow "Active" page can never
   * land in an "Archived" list.
   */
  private _listSeq = 0;

  readonly roster = this._roster.asReadonly();
  readonly rosterLoading = this._rosterLoading.asReadonly();
  readonly rosterError = this._rosterError.asReadonly();

  readonly clients = this._clients.asReadonly();
  readonly listLoading = this._listLoading.asReadonly();
  readonly listError = this._listError.asReadonly();

  /**
   * Owned by `MoreBadgesService`, which the tab shell already keeps current.
   * Reading it here rather than fetching again keeps the hourglass on this
   * page and the dot on the Menu tab on one number from one request — two
   * owners meant two calls on every load of this tab.
   */
  readonly pendingCount = this._moreBadgesService.pendingRequests;

  /** In the API's order: needs-attention first, then least adherent. */
  readonly attentionClients = computed(() =>
    (this._roster()?.clients ?? []).filter((client) => client.attention !== null),
  );

  readonly onTrackClients = computed(() =>
    (this._roster()?.clients ?? []).filter((client) => client.attention === null),
  );

  /**
   * What the triage actually renders. The unfiltered lists above stay the
   * source for every count on the screen: narrowing the segment badge and
   * the "2 of 8 need a look" note as you type would make the search look
   * like it had archived people rather than hidden them.
   */
  readonly visibleAttentionClients = computed(() => this._narrowRoster(this.attentionClients()));

  readonly visibleOnTrackClients = computed(() => this._narrowRoster(this.onTrackClients()));

  readonly attentionCount = computed(() => this.attentionClients().length);

  readonly rosterTotal = computed(() => this._roster()?.totals.clients ?? 0);

  /** Loaded, someone is on the roster, and nobody needs a nudge. */
  readonly allClear = computed(
    () => this._rosterLoaded() && this.rosterTotal() > 0 && this.attentionCount() === 0,
  );

  /** Loaded and nobody is on the roster at all — no active clients yet. */
  readonly triageEmpty = computed(
    () => this._rosterLoaded() && (this._roster()?.clients.length ?? 0) === 0,
  );

  /** A search is running and it hid the whole roster. */
  readonly isRosterFilteredEmpty = computed(
    () =>
      !!this.query().trim() &&
      this._rosterLoaded() &&
      this.visibleAttentionClients().length === 0 &&
      this.visibleOnTrackClients().length === 0,
  );

  /**
   * The rows on screen. The API has already applied the search, so this
   * only re-filters while a newly typed term is still in flight — without
   * it the previous result set would sit there looking like a match.
   */
  readonly visibleClients = computed(() => {
    const query = this.query();
    const clients = this._clients();
    if (!query.trim() || query === this._appliedQuery()) return clients;
    return clients.filter((client) => matchesClientQuery(client, query));
  });

  readonly hasMore = computed(() => this._clients().length < this._total());

  readonly allCountLabel = computed(() => {
    const total = this._allTotal();
    return total === null ? 'All clients' : `All clients · ${total}`;
  });

  readonly hasPendingRequests = computed(() => this.pendingCount() > 0);

  private readonly _isAttention = computed(() => this.segment() === ClientsSegments.Attention);

  private _narrowRoster(clients: readonly RosterClient[]): RosterClient[] {
    const query = this.query();
    if (!query.trim()) return [...clients];
    return clients.filter((client) => matchesRosterQuery(client, query));
  }

  readonly showSkeleton = computed(() =>
    this._isAttention()
      ? this._rosterLoading() && !this._roster()
      : this._listLoading() && this._clients().length === 0,
  );

  readonly showLoadError = computed(() =>
    this._isAttention()
      ? this._rosterError() && !this._roster()
      : this._listError() && this._clients().length === 0,
  );

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

  /** The search has come back from the API, so the result is the whole roster. */
  readonly searchSettled = computed(
    () => this.query().trim() === this._appliedQuery().trim(),
  );

  /**
   * The last load of the segment on screen failed, but there are rows from
   * an earlier one still under it.
   *
   * Keeping stale rows is right; letting them pass for current is not. A
   * toast only covers the refresh someone asked for by hand — entering the
   * tab refreshes too, and that failure needs something that stays put.
   */
  readonly isStale = computed(() =>
    this._isAttention()
      ? this._rosterError() && !!this._roster()
      : this._listError() && this._clients().length > 0,
  );

  /** The segment and chips stay on an error screen — you need them to try the other lens. */
  readonly showChrome = computed(() => !this.isEmpty());

  /**
   * Load both lenses and the requests count. `done` fires when the segment on
   * screen settles; the other lens and the count are nice-to-have and must not
   * hold a refresher spinner.
   */
  load(opts: LoadOptions = {}): void {
    if (this._isAttention()) {
      this.loadRoster({ force: opts.force, done: opts.done });
      this.loadList({ force: opts.force });
    } else {
      this.loadList({ force: opts.force, done: opts.done });
      this.loadRoster({ force: opts.force });
    }
    this.loadPendingCount();
  }

  /**
   * Silent by construction: the skeleton only shows over an empty list. The
   * callback is handed the failure so a pull-to-refresh can say so — stale
   * rows left on screen with no word look exactly like fresh ones.
   */
  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  loadRoster(opts: LoadOptions = {}): void {
    if (this._rosterLoading() || (this._rosterLoaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._rosterLoading.set(true);
    this._rosterError.set(false);

    this._rosterService
      .roster(ROSTER_WINDOW)
      .pipe(take(1))
      .subscribe({
        next: (summary) => {
          this._roster.set(summary);
          this._rosterLoaded.set(true);
          this._rosterLoading.set(false);
          opts.done?.();
        },
        error: (error: unknown) => {
          this._rosterError.set(true);
          this._rosterLoading.set(false);
          opts.done?.(error);
        },
      });
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

  setSegment(segment: ClientsSegment): void {
    this.segment.set(segment);
    // Both lenses load on entry; this only fills a gap an earlier error left.
    if (segment === ClientsSegments.Attention) this.loadRoster();
    else this.loadList();
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
    this.query.set(value);
    if (this.segment() !== ClientsSegments.All) return;
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
    const hadQuery = !!this.query();
    this.query.set('');
    if (this.filter() !== ClientFilterIds.All) {
      this.setFilter(ClientFilterIds.All);
      return;
    }
    // `setFilter` early-returns when the chip is already All, so the
    // cleared search would never reach the API without this.
    if (hadQuery && this.segment() === ClientsSegments.All) {
      this._resetList();
      this.loadList({ force: true });
    }
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
  // relationship verbs key on `clientId` (the person), the request verb on
  // `id` (the request). The row is patched the moment the call lands and the
  // roster re-read, since who is "on track" just changed.

  archive(client: InstructorClient): Observable<InstructorClient> {
    return this._clientService.archiveClient(client.clientId).pipe(
      take(1),
      tap((updated) => {
        this._settle(client.id, updated, InstructorClientStatuses.Active);
        this.loadRoster({ force: true });
      }),
    );
  }

  unarchive(client: InstructorClient): Observable<InstructorClient> {
    return this._clientService.unarchiveClient(client.clientId).pipe(
      take(1),
      tap((updated) => {
        this._settle(client.id, updated, InstructorClientStatuses.Archived);
        this.loadRoster({ force: true });
      }),
    );
  }

  /** Withdraw an invitation the coach sent. Only the sender may. */
  withdraw(client: InstructorClient): Observable<unknown> {
    return this._clientService.cancelRequest(client.id).pipe(
      take(1),
      tap(() => {
        this._clients.update((rows) => rows.filter((row) => row.id !== client.id));
        this._total.update((total) => Math.max(0, total - 1));
        this.loadPendingCount(true);
      }),
    );
  }

  updateNotes(client: InstructorClient, notes: string): Observable<InstructorClient> {
    return this._clientService.updateClient(client.clientId, { notes }).pipe(
      take(1),
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
    const search = this.query().trim();
    this._listLoading.set(true);
    this._listError.set(false);

    this._clientService
      .getClients({ status, search, page, limit: PAGE_SIZE })
      .pipe(take(1))
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
          // Only an unfiltered page can speak for the whole directory — a
          // searched total would shrink "All clients · N" to the matches.
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
