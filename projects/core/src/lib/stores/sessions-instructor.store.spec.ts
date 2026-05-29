import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionsInstructorStore } from './sessions-instructor.store';
import { environment } from '../../environments/environment';

const BASE = environment.apiUrl;

const futureIso = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function fakeTemplate(overrides: Partial<{ id: string; isRecurring: boolean }> = {}): unknown {
  return {
    id: overrides.id ?? 'tmpl-1',
    instructorId: 'usr-1',
    groupId: null,
    venueId: null,
    slug: 'yoga',
    title: 'Yoga',
    description: null,
    type: 'OPEN',
    access: 'OPEN',
    approvalRequired: false,
    locationKind: 'ONLINE',
    meetingUrl: 'https://meet.google.com/x',
    meetingProvider: 'GOOGLE_MEET',
    durationMinutes: 60,
    timezone: 'Europe/Bucharest',
    capacity: 10,
    waitlistEnabled: true,
    cancellationCutoffHours: 24,
    priceAmountCents: 0,
    priceCurrency: 'RON',
    isRecurring: overrides.isRecurring ?? false,
    recurrenceRule: null,
    firstStartAt: futureIso(2),
    status: 'ACTIVE',
    endedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function fakeInstance(
  overrides: Partial<{
    id: string;
    templateId: string;
    startAt: string;
    confirmedCount: number;
    pendingApprovalCount: number;
    conflictingInstanceIds: string[] | null;
  }> = {},
): unknown {
  return {
    id: overrides.id ?? 'inst-1',
    templateId: overrides.templateId ?? 'tmpl-1',
    instructorId: 'usr-1',
    occurrenceIndex: 0,
    startAt: overrides.startAt ?? futureIso(2),
    endAt: futureIso(2),
    titleOverride: null,
    descriptionOverride: null,
    venueIdOverride: null,
    meetingUrlOverride: null,
    capacityOverride: null,
    isOverride: false,
    status: 'SCHEDULED',
    cancelReason: null,
    cancelledAt: null,
    confirmedCount: overrides.confirmedCount ?? 3,
    pendingApprovalCount: overrides.pendingApprovalCount ?? 0,
    waitlistedCount: 0,
    attendedCount: null,
    conflictingInstanceIds: overrides.conflictingInstanceIds ?? null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('SessionsInstructorStore', () => {
  let store: SessionsInstructorStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionsInstructorStore,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(SessionsInstructorStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushReload(
    templatesRes: { items: unknown[]; total: number; page: number; pageSize: number },
    instancesRes: { items: unknown[]; total: number; page: number; pageSize: number },
  ): void {
    const reqs = httpMock.match(() => true);
    // Expect 2 calls: templates + instances
    const tReq = reqs.find((r) => r.request.url === `${BASE}/sessions/templates`);
    const iReq = reqs.find((r) => r.request.url === `${BASE}/sessions/instances`);
    expect(tReq).toBeDefined();
    expect(iReq).toBeDefined();
    tReq!.flush(templatesRes);
    iReq!.flush(instancesRes);
  }

  it('reload() fires templates + instances in parallel', () => {
    store.reload();
    flushReload(
      { items: [fakeTemplate()], total: 1, page: 1, pageSize: 20 },
      { items: [fakeInstance()], total: 1, page: 1, pageSize: 100 },
    );
    expect(store.templates().length).toBe(1);
    expect(store.total()).toBe(1);
  });

  it('nextInstanceFor returns the earliest scheduled instance per template', () => {
    store.reload();
    const inst1 = fakeInstance({ id: 'i-1', startAt: futureIso(5) });
    const inst2 = fakeInstance({ id: 'i-2', startAt: futureIso(2) });
    flushReload(
      { items: [fakeTemplate()], total: 1, page: 1, pageSize: 20 },
      { items: [inst1, inst2], total: 2, page: 1, pageSize: 100 },
    );
    const next = store.nextInstanceFor('tmpl-1');
    expect(next).toBeTruthy();
    expect((next as { id: string }).id).toBe('i-2'); // earliest
  });

  it('setTab() resets page + reloads', () => {
    store.reload();
    flushReload(
      { items: [], total: 0, page: 1, pageSize: 20 },
      { items: [], total: 0, page: 1, pageSize: 100 },
    );
    store.setTab('recurring');
    expect(store.tab()).toBe('recurring');
    expect(store.page()).toBe(1);
    // Verify the new request has tab=recurring
    const tReq = httpMock.expectOne(
      (r) =>
        r.url === `${BASE}/sessions/templates` &&
        r.params.get('tab') === 'recurring',
    );
    tReq.flush({ items: [], total: 0, page: 1, pageSize: 20 });
    httpMock
      .expectOne((r) => r.url === `${BASE}/sessions/instances`)
      .flush({ items: [], total: 0, page: 1, pageSize: 100 });
  });

  it('setFilters() merges and reloads', () => {
    store.reload();
    flushReload(
      { items: [], total: 0, page: 1, pageSize: 20 },
      { items: [], total: 0, page: 1, pageSize: 100 },
    );
    store.setFilters({ q: 'yoga', type: 'GROUP' });
    expect(store.filters()).toEqual({ q: 'yoga', type: 'GROUP' });
    const tReq = httpMock.expectOne(
      (r) =>
        r.url === `${BASE}/sessions/templates` &&
        r.params.get('q') === 'yoga' &&
        r.params.get('type') === 'GROUP',
    );
    tReq.flush({ items: [], total: 0, page: 1, pageSize: 20 });
    httpMock
      .expectOne((r) => r.url === `${BASE}/sessions/instances`)
      .flush({ items: [], total: 0, page: 1, pageSize: 100 });
  });

  it('kpis computed: counts recurring + signups + conflicts', () => {
    store.reload();
    const recurring = fakeTemplate({ id: 't-rec', isRecurring: true });
    flushReload(
      { items: [fakeTemplate(), recurring], total: 2, page: 1, pageSize: 20 },
      {
        items: [
          fakeInstance({ confirmedCount: 5, pendingApprovalCount: 2 }),
          fakeInstance({
            id: 'i-2',
            templateId: 't-rec',
            confirmedCount: 3,
            conflictingInstanceIds: ['x'],
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      },
    );
    const k = store.kpis();
    expect(k.recurring).toBe(1);
    // 5 confirmed + 2 pending + 3 confirmed + 0 pending = 10
    expect(k.totalSignups).toBe(10);
    // 1 conflict + 2 pending = 3
    expect(k.needsAttention).toBe(3);
  });

  it('error path: templates HTTP error surfaces store.error and resets list', () => {
    store.reload();
    const tReq = httpMock.expectOne(`${BASE}/sessions/templates?tab=active&page=1&limit=20`);
    tReq.error(new ProgressEvent('Network'), { status: 500, statusText: 'boom' });
    httpMock
      .expectOne((r) => r.url === `${BASE}/sessions/instances`)
      .flush({ items: [], total: 0, page: 1, pageSize: 100 });
    expect(store.templates().length).toBe(0);
    expect(store.total()).toBe(0);
    expect(store.error()).toBeTruthy();
  });

  // ─── Calendar range cache (Phase C) ──────────────────────────────

  it('AUDIT FIX: loadRange() respects BE limit cap of 100', () => {
    // Earlier I sent limit=200; BE rejects with 400 because PaginationDto
    // has @Max(100). This test pins the FE side at 100 to prevent a regression.
    store.loadRange({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2026-12-08T00:00:00Z'),
    });
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/instances`);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ items: [], total: 0, page: 1, pageSize: 100 });
  });

  it('loadRange() served from cache on second call with same range', () => {
    const range = {
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2026-12-08T00:00:00Z'),
    };
    store.loadRange(range);
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${BASE}/sessions/instances` &&
        r.params.get('dateFrom') === range.start.toISOString() &&
        r.params.get('dateTo') === range.end.toISOString(),
    );
    req.flush({ items: [fakeInstance()], total: 1, page: 1, pageSize: 200 });
    expect(store.rangeInstances().length).toBe(1);

    // Second call to the SAME range — must serve from cache (no HTTP).
    store.loadRange(range);
    httpMock.expectNone((r) => r.url === `${BASE}/sessions/instances`);
    expect(store.rangeInstances().length).toBe(1);
  });

  it('loadRange() error path surfaces rangeError + clears instances', () => {
    store.loadRange({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2026-12-08T00:00:00Z'),
    });
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/instances`);
    req.error(new ProgressEvent('Network'), { status: 500 });
    expect(store.rangeError()).toBeTruthy();
    expect(store.rangeInstances().length).toBe(0);
    expect(store.rangeLoading()).toBe(false);
  });

  it('prependInstanceOptimistic adds; removeInstance takes it out', () => {
    store.loadRange({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2026-12-08T00:00:00Z'),
    });
    httpMock
      .expectOne((r) => r.url === `${BASE}/sessions/instances`)
      .flush({
        items: [fakeInstance({ id: 'a' })],
        total: 1,
        page: 1,
        pageSize: 200,
      });

    const b = fakeInstance({ id: 'b' }) as never;
    store.prependInstanceOptimistic(b);
    expect(store.rangeInstances()[0].id).toBe('b');

    store.removeInstance('b');
    expect(store.rangeInstances().find((i) => i.id === 'b')).toBeUndefined();
  });
});
