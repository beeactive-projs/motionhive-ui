import { computed, signal } from '@angular/core';
import { Observable, take } from 'rxjs';

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
 * - The latest request wins: a response a newer one overtook (another
 *   chip, another day, a refresh) is dropped, though its `done` still
 *   runs, so a refresher or a scroll spinner always stops.
 */
export class PagedList<T extends { id: string }> {
  private readonly _items = signal<T[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private _pages = 0;
  private _seq = 0;

  readonly items = this._items.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** A first read has come back, with rows or without. */
  readonly loaded = this._loaded.asReadonly();
  /** The first read failed; a failed Show more keeps the rows and says nothing. */
  readonly failed = this._failed.asReadonly();
  readonly hasMore = computed(() => this._items().length < this._total());

  constructor(
    private readonly _pageSize: number,
    private readonly _read: PageReader<T>,
  ) {}

  /** Empty, as before anything was read; a read still on its way is dropped. */
  clear(): void {
    this._seq += 1;
    this._items.set([]);
    this._total.set(0);
    this._pages = 0;
    this._loading.set(false);
    this._loaded.set(false);
    this._failed.set(false);
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
    const seq = ++this._seq;
    this._loading.set(true);
    this._read(page, pages * this._pageSize)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (seq === this._seq) {
            this._items.update((rows) =>
              replace ? result.items : appendUnique(rows, result.items),
            );
            this._total.set(result.total);
            // A refresh read several pages as one request; count it as them.
            this._pages = replace ? pages : page;
            this._failed.set(false);
            this._loaded.set(true);
            this._loading.set(false);
          }
          done?.();
        },
        error: () => {
          if (seq === this._seq) {
            if (replace) this._failed.set(true);
            this._loaded.set(true);
            this._loading.set(false);
          }
          done?.();
        },
      });
  }
}

function appendUnique<T extends { id: string }>(rows: T[], incoming: T[]): T[] {
  const held = new Set(rows.map((row) => row.id));
  return [...rows, ...incoming.filter((row) => !held.has(row.id))];
}
