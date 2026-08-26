import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionsDiscoverStore } from './sessions-discover.store';
import { environment } from '../../environments/environment';

const BASE = environment.apiUrl;
const URL = `${BASE}/sessions/discover`;

const futureIso = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function fakeInstance(overrides: Partial<{ id: string }> = {}): unknown {
  return {
    id: overrides.id ?? 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'usr-1',
    occurrenceIndex: 0,
    startAt: futureIso(2),
    endAt: futureIso(2),
    titleOverride: null,
    descriptionOverride: null,
    venueIdOverride: null,
    capacityOverride: null,
    isOverride: false,
    status: 'SCHEDULED',
    cancelledAt: null,
    confirmedCount: 3,
    pendingApprovalCount: 0,
    waitlistedCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function page(items: unknown[], total: number, pageNo = 1): object {
  return { items, total, page: pageNo, pageSize: 20 };
}

describe('SessionsDiscoverStore', () => {
  let store: SessionsDiscoverStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionsDiscoverStore,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(SessionsDiscoverStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('load() fetches page 1 and replaces items', () => {
    store.load();
    expect(store.loading()).toBe(true);
    httpMock
      .expectOne((r) => r.url === URL)
      .flush(page([fakeInstance()], 1));
    expect(store.items().length).toBe(1);
    expect(store.total()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  // The re-entrancy regression this store shipped with: setFilters()
  // cleared items and called load(), which early-returned while a request
  // was in flight — the wipe stuck and nothing refetched. switchMap must
  // cancel the stale request and let the newer one populate the list.
  it('REGRESSION: setFilters() mid-flight cancels the stale request and refetches', () => {
    store.load();
    const first = httpMock.expectOne((r) => r.url === URL);

    store.setFilters({ q: 'yoga' });
    expect(first.cancelled).toBe(true);

    const second = httpMock.expectOne(
      (r) => r.url === URL && r.params.get('q') === 'yoga',
    );
    second.flush(page([fakeInstance()], 1));
    expect(store.items().length).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('loadMore() appends to page-1 items', () => {
    store.load();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush(page([fakeInstance({ id: 'a' })], 2));

    store.loadMore();
    httpMock
      .expectOne((r) => r.url === URL && r.params.get('page') === '2')
      .flush(page([fakeInstance({ id: 'b' })], 2, 2));

    expect(store.items().map((i) => i.id)).toEqual(['a', 'b']);
    expect(store.hasMore()).toBe(false);
  });

  it('loadMore() while exhausted or loading still completes its caller', () => {
    store.load();
    httpMock.expectOne((r) => r.url === URL).flush(page([fakeInstance()], 1));

    // Exhausted (items == total) — done fires without a request.
    let called = false;
    store.loadMore(() => (called = true));
    httpMock.expectNone((r) => r.url === URL);
    expect(called).toBe(true);
  });

  it('dateFrom/dateTo filters reach the query string', () => {
    store.setFilters({
      dateFrom: '2026-08-26T00:00:00.000Z',
      dateTo: '2026-09-02T00:00:00.000Z',
    });
    const req = httpMock.expectOne(
      (r) =>
        r.url === URL &&
        r.params.get('dateFrom') === '2026-08-26T00:00:00.000Z' &&
        r.params.get('dateTo') === '2026-09-02T00:00:00.000Z',
    );
    req.flush(page([], 0));
    expect(store.error()).toBeNull();
  });

  it('setFilters with undefined values drops the params entirely', () => {
    store.setFilters({ q: 'yoga' });
    httpMock.expectOne((r) => r.url === URL).flush(page([], 0));

    store.setFilters({ q: undefined });
    const req = httpMock.expectOne((r) => r.url === URL);
    expect(req.request.params.has('q')).toBe(false);
    req.flush(page([], 0));
  });

  // Pull-to-refresh hangs its spinner on this callback — every exit has
  // to fire it, including a request that got superseded mid-flight.
  it('done callbacks flush on success, on error, and on supersession', () => {
    let calls = 0;
    const done = () => calls++;

    // Success.
    store.load(done);
    httpMock.expectOne((r) => r.url === URL).flush(page([], 0));
    expect(calls).toBe(1);

    // Error.
    store.load(done);
    httpMock
      .expectOne((r) => r.url === URL)
      .error(new ProgressEvent('Network'), { status: 500 });
    expect(calls).toBe(2);
    expect(store.error()).toBeTruthy();

    // Superseded: both callers complete when the winning response lands.
    store.load(done);
    store.load(done);
    const reqs = httpMock.match((r) => r.url === URL);
    expect(reqs.length).toBe(2);
    expect(reqs[0].cancelled).toBe(true);
    reqs[1].flush(page([], 0));
    expect(calls).toBe(4);
  });

  it('reload() refetches page 1 but keeps items on screen until the response', () => {
    store.load();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush(page([fakeInstance({ id: 'a' })], 1));

    store.reload();
    // Items survive the request window (no blank flash on refresh)…
    expect(store.items().length).toBe(1);
    const req = httpMock.expectOne(
      (r) => r.url === URL && r.params.get('page') === '1',
    );
    req.flush(page([fakeInstance({ id: 'b' })], 1));
    // …and the response replaces them.
    expect(store.items().map((i) => i.id)).toEqual(['b']);
  });
});
