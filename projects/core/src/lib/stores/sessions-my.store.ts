import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { SessionService } from '../services/session/session.service';
import { apiErrorMessage } from '../utils/api-error.utils';
import type {
  MyCounts,
  SessionParticipant,
} from '../models/session/session.model';
import { MyTab } from '../models/session/session.enums';

/**
 * "My sessions" store — drives the client-side bookings page.
 *
 * State per tab is kept in a map keyed by `MyTab` so switching back and
 * forth doesn't re-hit the API every time. `counts` (the tab-badge
 * numbers) loads on first init via `GET /sessions/my/counts`.
 */
@Injectable()
export class SessionsMyStore {
  private readonly _svc = inject(SessionService);
  // Tied to the page that provides this store; cancels pending HTTP
  // when the user navigates away mid-fetch.
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _itemsByTab = signal<Map<MyTab, SessionParticipant[]>>(new Map());
  private readonly _totals = signal<Map<MyTab, number>>(new Map());
  private readonly _counts = signal<MyCounts | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _tab = signal<MyTab>(MyTab.Upcoming);
  private readonly _page = signal(1);
  private readonly _pageSize = signal(20);

  // ─── Public ───────────────────────────────────────────────────────
  readonly tab = this._tab.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly counts = this._counts.asReadonly();
  readonly page = this._page.asReadonly();

  readonly items = computed<SessionParticipant[]>(
    () => this._itemsByTab().get(this._tab()) ?? [],
  );

  readonly total = computed(() => this._totals().get(this._tab()) ?? 0);

  readonly hasMore = computed(() => this.items().length < this.total());

  // ─── Mutators ─────────────────────────────────────────────────────

  setTab(tab: MyTab): void {
    if (this._tab() === tab) return;
    this._tab.set(tab);
    this._page.set(1);
    // Always re-load on tab switch so counters stay fresh.
    this.load();
  }

  // ─── Load ─────────────────────────────────────────────────────────

  load(): void {
    if (this._loading()) return;
    this._loading.set(true);
    this._error.set(null);
    const tab = this._tab();
    const requests = {
      list: this._svc
        .listMy({ tab, page: this._page(), limit: this._pageSize() })
        .pipe(
          catchError((err: unknown) => {
            this._error.set(apiErrorMessage(err, 'Could not load your sessions'));
            return of({
              items: [] as SessionParticipant[],
              total: 0,
              page: 1,
              pageSize: this._pageSize(),
            });
          }),
        ),
      counts: this._counts() == null
        ? this._svc.myCounts().pipe(catchError(() => of(null)))
        : of(this._counts()),
    };
    forkJoin(requests)
      .pipe(
        tap(({ list, counts }) => {
          const itemsMap = new Map(this._itemsByTab());
          const totalsMap = new Map(this._totals());
          const prev = this._page() === 1 ? [] : itemsMap.get(tab) ?? [];
          itemsMap.set(tab, [...prev, ...list.items]);
          totalsMap.set(tab, list.total);
          this._itemsByTab.set(itemsMap);
          this._totals.set(totalsMap);
          if (counts) this._counts.set(counts);
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({ complete: () => this._loading.set(false) });
  }

  loadMore(): void {
    if (!this.hasMore() || this._loading()) return;
    this._page.set(this._page() + 1);
    this.load();
  }

  /** Invalidate a tab's cache (e.g. after cancelling a booking). */
  invalidateTab(tab: MyTab): void {
    const m = new Map(this._itemsByTab());
    m.delete(tab);
    this._itemsByTab.set(m);
    if (this._tab() === tab) {
      this._page.set(1);
      this.load();
    }
    // Also refresh counts.
    this._counts.set(null);
  }

}
