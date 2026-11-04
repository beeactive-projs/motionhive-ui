import { computed, signal } from '@angular/core';
import { Observable, Subscription, finalize, take } from 'rxjs';

import { appendUnique } from 'core';

/** The list endpoints refuse a `limit` above this. */
const API_MAX_LIMIT = 100;

/** What a list endpoint returns for one request. */
export interface PageOf<T> {
  items: T[];
  total: number;
}

/** One request: `limit` rows, starting at page `page` of `limit`-sized pages. */
export type PageReader<T> = (page: number, limit: number) => Observable<PageOf<T>>;

/**
 * A list read a page at a time behind Show more: the rows on screen, the
 * total, and the page to ask for next.
 *
 * - The pages on screen are counted, not derived from the rows. Derived,
 *   a short page (a row deleted above it, or a repeat dropped) rounds
 *   down and asks for the same page again, forever.
 * - A page appends only the rows not already on screen: a row added on
 *   the server between two pages pushes one already shown into the next.
 * - A refresh re-reads the pages on screen in one request, so coming back
 *   to the list keeps the place and the next Show more carries on from
 *   the right row. Capped at what one request may ask for.
 * - The latest request wins: a newer one (another chip, another day, a
 *   refresh, another search) cancels the one on its way, so the server
 *   stops working for nobody. The cancelled read's `done` still runs, so
 *   a refresher or a scroll spinner always stops.
 * - A page shorter than asked is the end, whatever the total says: with a
 *   repeat dropped the rows stay one short of it for good, and Show more
 *   would ask past the end forever.
 */
export class PagedList<T extends { id: string }> {
  private readonly _items = signal<T[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private readonly _endReached = signal(false);
  private _pages = 0;
  private _inFlight?: Subscription;

  readonly items = this._items.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** A first read has come back, with rows or without. */
  readonly loaded = this._loaded.asReadonly();
  /** The first read failed; a failed Show more keeps the rows and says nothing. */
  readonly failed = this._failed.asReadonly();
  readonly hasMore = computed(() => !this._endReached() && this._items().length < this._total());

  constructor(
    private readonly _pageSize: number,
    private readonly _read: PageReader<T>,
  ) {}

  /** Empty, as before anything was read; a read still on its way is cancelled. */
  clear(): void {
    this._inFlight?.unsubscribe();
    this._items.set([]);
    this._total.set(0);
    this._pages = 0;
    this._loading.set(false);
    this._loaded.set(false);
    this._failed.set(false);
    this._endReached.set(false);
  }

  /** The first page again, in place of what is on screen once it lands. */
  reset(done?: () => void): void {
    this._fetch(1, 1, true, done);
  }

  /** The pages on screen again, in one request. */
  refresh(done?: () => void): void {
    const pages = Math.min(Math.max(this._pages, 1), Math.floor(API_MAX_LIMIT / this._pageSize));
    this._fetch(1, pages, true, done);
  }

  /** The next page, unless one is on its way or every row is shown. */
  more(done?: () => void): void {
    if (this._loading() || !this.hasMore()) {
      done?.();
      return;
    }
    this._fetch(this._pages + 1, 1, false, done);
  }

  private _fetch(page: number, pages: number, replace: boolean, done?: () => void): void {
    this._inFlight?.unsubscribe();
    const limit = pages * this._pageSize;
    this._loading.set(true);
    this._inFlight = this._read(page, limit)
      .pipe(
        take(1),
        // On the answer, on a failure and on a cancel alike.
        finalize(() => done?.()),
      )
      .subscribe({
        next: (result) => {
          this._items.update((rows) => (replace ? result.items : appendUnique(rows, result.items)));
          this._total.set(result.total);
          // A refresh read several pages as one request; count it as them.
          this._pages = replace ? pages : page;
          this._endReached.set(result.items.length < limit);
          this._failed.set(false);
          this._loaded.set(true);
          this._loading.set(false);
        },
        error: () => {
          if (replace) this._failed.set(true);
          this._loaded.set(true);
          this._loading.set(false);
        },
      });
  }
}
