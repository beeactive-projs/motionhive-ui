import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import {
  ClientService,
  MyQuery,
  MyTab,
  SessionParticipant,
  SessionParticipantStatus,
  SessionService,
} from 'core';

import { MySessionsStore } from './my-sessions.store';

const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 3_600_000;

function at(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

function booking(
  id: string,
  startMs: number,
  status: SessionParticipantStatus = SessionParticipantStatus.Confirmed,
): SessionParticipant {
  return {
    id,
    instanceId: `i-${id}`,
    status,
    instance: { startAt: at(startMs), endAt: at(startMs + HOUR) },
  } as unknown as SessionParticipant;
}

function page(items: SessionParticipant[], total: number) {
  return { items, total, page: 1, pageSize: items.length };
}

interface Fixtures {
  upcoming?: ReturnType<typeof page>;
  pending?: ReturnType<typeof page>;
  waitlisted?: ReturnType<typeof page>;
  past?: Record<number, ReturnType<typeof page>>;
}

function setup(fixtures: Fixtures = {}) {
  const empty = page([], 0);
  const listMy = vi.fn((query: MyQuery = {}) => {
    switch (query.tab) {
      case MyTab.Upcoming:
        return of(fixtures.upcoming ?? empty);
      case MyTab.PendingApproval:
        return of(fixtures.pending ?? empty);
      case MyTab.Waitlisted:
        return of(fixtures.waitlisted ?? empty);
      case MyTab.Past:
        return of(fixtures.past?.[query.page ?? 1] ?? empty);
      default:
        return of(empty);
    }
  });
  const myCounts = vi.fn(() =>
    of({ upcoming: 2, pendingApproval: 1, waitlisted: 1, past: 9, cancelled: 3 }),
  );

  TestBed.configureTestingModule({
    providers: [
      MySessionsStore,
      { provide: SessionService, useValue: { listMy, myCounts } },
      { provide: ClientService, useValue: { getMyInstructors: vi.fn(() => of([])) } },
    ],
  });
  return { store: TestBed.inject(MySessionsStore), listMy };
}

describe('MySessionsStore', () => {
  // The design's 3-way fold, plus the hole in it: the BE's `upcoming` tab is
  // `startAt >= now`, so the LIVE session — the row that carries the Join
  // pill — sits in `past` and must be lifted back.
  it('merges the three active tabs and lifts the live session from past', () => {
    const live = booking('live', -10 * MINUTE);
    const finished = booking('old', -2 * 24 * HOUR);
    const { store } = setup({
      upcoming: page([booking('a', 2 * HOUR)], 1),
      pending: page([booking('b', 26 * HOUR, SessionParticipantStatus.PendingApproval)], 1),
      waitlisted: page([booking('c', 5 * HOUR, SessionParticipantStatus.Waitlisted)], 1),
      past: { 1: page([live, finished], 40) },
    });

    store.loadUpcoming();

    // Sorted by start ascending: the live one leads, the finished one is out.
    expect(store.upcoming().map((b) => b.id)).toEqual(['live', 'a', 'c', 'b']);
  });

  it('does not lift cancelled or declined rows even when recent', () => {
    const recentCancelled = booking('x', -10 * MINUTE, SessionParticipantStatus.Cancelled);
    const { store } = setup({ past: { 1: page([recentCancelled], 1) } });

    store.loadUpcoming();

    expect(store.upcoming()).toEqual([]);
  });

  it('flags truncation when any active tab holds more than one page', () => {
    const { store } = setup({
      upcoming: { ...page([booking('a', HOUR)], 250) },
    });
    store.loadUpcoming();
    expect(store.upcomingTruncated()).toBe(true);
  });

  it('sums the three active counts for the segment label', () => {
    const { store } = setup();
    store.loadCounts();
    expect(store.upcomingCount()).toBe(4);
    expect(store.cancelledCount()).toBe(3);
  });

  it('pages past and knows when there is more', () => {
    const { store } = setup({
      past: {
        1: page([booking('p1', -24 * HOUR), booking('p2', -48 * HOUR)], 3),
        2: page([booking('p3', -72 * HOUR)], 3),
      },
    });

    store.loadPast();
    expect(store.past().map((b) => b.id)).toEqual(['p1', 'p2']);
    expect(store.hasMorePast()).toBe(true);

    store.loadMorePast();
    expect(store.past().map((b) => b.id)).toEqual(['p1', 'p2', 'p3']);
    expect(store.hasMorePast()).toBe(false);
  });

  it('keeps loaded data and raises the flag when a reload fails', () => {
    const { store, listMy } = setup({ upcoming: page([booking('a', HOUR)], 1) });
    store.loadUpcoming();
    expect(store.upcoming()).toHaveLength(1);

    listMy.mockReturnValue(throwError(() => new Error('offline')));
    store.loadUpcoming({ force: true });

    expect(store.upcomingError()).toBe(true);
    expect(store.upcoming()).toHaveLength(1);
  });

  it('skips a refetch when already loaded, unless forced', () => {
    const { store, listMy } = setup({ upcoming: page([booking('a', HOUR)], 1) });
    store.loadUpcoming();
    const calls = listMy.mock.calls.length;

    store.loadUpcoming();
    expect(listMy.mock.calls.length).toBe(calls);

    store.loadUpcoming({ force: true });
    expect(listMy.mock.calls.length).toBeGreaterThan(calls);
  });
});
