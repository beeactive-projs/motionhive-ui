import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PageOf, PagedList } from './paged-list';

type Row = { id: string };
const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));

describe('PagedList', () => {
  it('appends the next page and knows when every row is shown', () => {
    const read = vi
      .fn()
      .mockReturnValueOnce(of({ items: rows('a', 'b'), total: 3 }))
      .mockReturnValueOnce(of({ items: rows('c'), total: 3 }));
    const list = new PagedList<Row>(2, read);

    list.reset();
    expect(list.hasMore()).toBe(true);
    list.more();

    expect(read).toHaveBeenNthCalledWith(2, 2, 2);
    expect(list.items().map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(list.hasMore()).toBe(false);
  });

  // A row added on the server between two pages pushes one already shown
  // into the next page; it must not appear twice.
  it('skips a row already on screen, and still moves on a page', () => {
    const read = vi
      .fn()
      .mockReturnValueOnce(of({ items: rows('a', 'b'), total: 5 }))
      .mockReturnValueOnce(of({ items: rows('b', 'c'), total: 5 }))
      .mockReturnValueOnce(of({ items: rows('d', 'e'), total: 5 }));
    const list = new PagedList<Row>(2, read);

    list.reset();
    list.more();
    list.more();

    expect(read.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
    expect(list.items().map((row) => row.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('refreshes the pages on screen in one request, then carries on after them', () => {
    const read = vi
      .fn()
      .mockReturnValueOnce(of({ items: rows('a', 'b'), total: 6 }))
      .mockReturnValueOnce(of({ items: rows('c', 'd'), total: 6 }))
      .mockReturnValueOnce(of({ items: rows('a', 'b', 'c', 'd'), total: 6 }))
      .mockReturnValueOnce(of({ items: rows('e', 'f'), total: 6 }));
    const list = new PagedList<Row>(2, read);

    list.reset();
    list.more();
    list.refresh();
    list.more();

    expect(read).toHaveBeenNthCalledWith(3, 1, 4);
    expect(read).toHaveBeenNthCalledWith(4, 3, 2);
  });

  it('never asks for more than one request may carry', () => {
    const read = vi.fn((_page: number, limit: number) =>
      of({
        items: rows(...Array.from({ length: limit }, (_, i) => `r${_page}-${i}`)),
        total: 1000,
      }),
    );
    const list = new PagedList<Row>(15, read);

    list.reset();
    for (let i = 0; i < 9; i++) list.more();
    list.refresh();

    expect(read.mock.calls.at(-1)).toEqual([1, 90]);
  });

  it('drops a response a newer request overtook, but still says it is done', () => {
    const slow = new Subject<PageOf<Row>>();
    const read = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockReturnValueOnce(of({ items: rows('new'), total: 1 }));
    const list = new PagedList<Row>(2, read);
    const done = vi.fn();

    list.reset(done);
    list.reset();
    slow.next({ items: rows('old'), total: 1 });

    expect(list.items().map((row) => row.id)).toEqual(['new']);
    expect(done).toHaveBeenCalled();
  });

  it('refuses a second Show more while one is on its way', () => {
    const pending = new Subject<PageOf<Row>>();
    const read = vi
      .fn()
      .mockReturnValueOnce(of({ items: rows('a', 'b'), total: 4 }))
      .mockReturnValueOnce(pending);
    const list = new PagedList<Row>(2, read);

    list.reset();
    list.more();
    list.more();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('says a first read failed, and keeps the rows when a later page fails', () => {
    const read = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ items: rows('a', 'b'), total: 4 }))
      .mockReturnValueOnce(throwError(() => new Error('offline')));
    const list = new PagedList<Row>(2, read);

    list.reset();
    expect(list.failed()).toBe(true);

    list.reset();
    list.more();
    expect(list.failed()).toBe(false);
    expect(list.items()).toHaveLength(2);
  });
});
