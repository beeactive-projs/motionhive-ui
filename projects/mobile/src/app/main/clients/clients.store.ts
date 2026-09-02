import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, take, tap } from 'rxjs';

import {
  ClientService,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  RosterService,
  RosterSummary,
} from 'core';

import {
  ClientFilterId,
  ClientFilterIds,
  ClientsSegment,
  ClientsSegments,
  ROSTER_WINDOW,
  filterStatus,
  matchesClientQuery,
} from './clients.config';

const PAGE_SIZE = 20;

type LoadOptions = { force?: boolean; done?: () => void };

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

  readonly segment = signal<ClientsSegment>(ClientsSegments.Attention);
  readonly filter = signal<ClientFilterId>(ClientFilterIds.All);
  /** The header search — narrows the loaded rows locally; `getClients` has no `q`. */
  readonly query = signal('');

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

  private readonly _pendingCount = signal(0);

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
  readonly pendingCount = this._pendingCount.asReadonly();

  /** In the API's order: needs-attention first, then least adherent. */
  readonly attentionClients = computed(() =>
    (this._roster()?.clients ?? []).filter((client) => client.attention !== null),
  );

  readonly onTrackClients = computed(() =>
    (this._roster()?.clients ?? []).filter((client) => client.attention === null),
  );

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

  readonly visibleClients = computed(() => {
    const query = this.query();
    const clients = this._clients();
    return query.trim() ? clients.filter((client) => matchesClientQuery(client, query)) : clients;
  });

  readonly hasMore = computed(() => this._clients().length < this._total());

  readonly allCountLabel = computed(() => {
    const total = this._allTotal();
    return total === null ? 'All clients' : `All clients · ${total}`;
  });

  readonly hasPendingRequests = computed(() => this._pendingCount() > 0);

  private readonly _isAttention = computed(() => this.segment() === ClientsSegments.Attention);

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

  /** Silent by construction: the skeleton only shows over an empty list. */
  refresh(done?: () => void): void {
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
        error: () => {
          this._rosterError.set(true);
          this._rosterLoading.set(false);
          opts.done?.();
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
  loadMore(done?: () => void): void {
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
    this._clients.set([]);
    this._total.set(0);
    this._page.set(1);
    this._listLoaded.set(false);
    this.loadList({ force: true });
  }

  clearFilters(): void {
    this.query.set('');
    this.setFilter(ClientFilterIds.All);
  }

  /** Counts feed a dot, not layout — a failure just hides it. */
  loadPendingCount(): void {
    this._clientService
      .getPendingRequestsCount()
      .pipe(take(1))
      .subscribe({
        next: (response) => this._pendingCount.set(response.count),
        error: () => this._pendingCount.set(0),
      });
  }

  /** A new invitation is a new PENDING row and one more request in flight. */
  onInviteSent(): void {
    this.loadList({ force: true });
    this.loadPendingCount();
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
        this.loadPendingCount();
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

  private _fetchPage(page: number, done?: () => void): void {
    const seq = ++this._listSeq;
    const status = filterStatus(this.filter());
    this._listLoading.set(true);
    this._listError.set(false);

    this._clientService
      .getClients({ status, page, limit: PAGE_SIZE })
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
          if (status === undefined) this._allTotal.set(response.total);
          this._listLoaded.set(true);
          this._listLoading.set(false);
          done?.();
        },
        error: () => {
          if (seq !== this._listSeq) {
            done?.();
            return;
          }
          // A failed later page leaves what we have; the next scroll retries.
          if (page === 1) this._listError.set(true);
          this._listLoading.set(false);
          done?.();
        },
      });
  }
}
