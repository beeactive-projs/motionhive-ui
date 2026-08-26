import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { SessionService } from '../services/session/session.service';
import { apiErrorMessage } from '../utils/api-error.utils';
import type {
  DiscoverQuery,
  PublicSessionInstance,
} from '../models/session/session.model';
import type {
  SessionLocationKind,
  SessionType,
} from '../models/session/session.enums';

/**
 * Discover store — drives the public "find a session" page.
 *
 * Anonymous-safe: it calls `GET /sessions/discover` which the BE marks
 * `@Public`. Auth interceptor still attaches the JWT when present so the
 * BE can optionally redact for logged-in users.
 *
 * Filters drive query-string params; paging is local. Results stream
 * into a single `items` signal that the page renders as cards.
 *
 * NOT `providedIn: 'root'` — page-scoped so leaving the discover page
 * disposes the store and any pending HTTP.
 */
export interface DiscoverFilters {
  q?: string;
  type?: SessionType;
  locationKind?: SessionLocationKind;
  instructorId?: string;
  groupId?: string;
  /** ISO 8601 lower bound (inclusive). BE caps the window at 90 days. */
  dateFrom?: string;
  /** ISO 8601 upper bound (exclusive). */
  dateTo?: string;
}

@Injectable()
export class SessionsDiscoverStore {
  private readonly _svc = inject(SessionService);

  // ─── State ─────────────────────────────────────────────────────────
  private readonly _items = signal<PublicSessionInstance[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _filters = signal<DiscoverFilters>({});
  private readonly _page = signal(1);
  private readonly _pageSize = signal(20);

  /** Refresher-style callbacks queued by `load()` — every exit flushes
   *  them, including a superseded request (its caller's spinner must not
   *  hang on a response that was cancelled). */
  private _pendingDones: (() => void)[] = [];

  // ─── Public readonly ──────────────────────────────────────────────
  readonly items = this._items.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly page = this._page.asReadonly();
  readonly pageSize = this._pageSize.asReadonly();

  readonly hasMore = computed(
    () => this._items().length < this._total(),
  );

  // ─── Load pipeline ────────────────────────────────────────────────

  private readonly _load$ = new Subject<void>();

  constructor() {
    // One long-lived pipeline; `switchMap` cancels a superseded in-flight
    // request, so `setFilters()` during a slow response refetches instead
    // of stranding the just-cleared list (the old `if (loading) return`
    // guard dropped that reload entirely).
    this._load$
      .pipe(
        switchMap(() => {
          const query: DiscoverQuery = {
            ...this._filters(),
            page: this._page(),
            limit: this._pageSize(),
          };
          return this._svc.discover(query).pipe(
            tap((res) => {
              // Append on subsequent pages, replace on page 1.
              if (this._page() === 1) this._items.set(res.items);
              else this._items.set([...this._items(), ...res.items]);
              this._total.set(res.total);
            }),
            catchError((err: unknown) => {
              this._error.set(apiErrorMessage(err, 'Could not load sessions'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this._loading.set(false);
        const dones = this._pendingDones;
        this._pendingDones = [];
        for (const done of dones) done();
      });
  }

  // ─── Mutators ─────────────────────────────────────────────────────

  setFilters(patch: Partial<DiscoverFilters>): void {
    this._filters.set({ ...this._filters(), ...patch });
    this._page.set(1);
    this._items.set([]);
    this.load();
  }

  setPage(page: number): void {
    this._page.set(page);
    this.load();
  }

  load(done?: () => void): void {
    if (done) this._pendingDones.push(done);
    this._loading.set(true);
    this._error.set(null);
    this._load$.next();
  }

  /** Page-1 refetch that keeps the current items on screen until the
   *  response replaces them — for view re-entry and pull-to-refresh,
   *  where a blank flash would lie about the data going away. */
  reload(done?: () => void): void {
    this._page.set(1);
    this.load(done);
  }

  loadMore(done?: () => void): void {
    if (!this.hasMore() || this._loading()) {
      done?.();
      return;
    }
    this._page.set(this._page() + 1);
    this.load(done);
  }

}
