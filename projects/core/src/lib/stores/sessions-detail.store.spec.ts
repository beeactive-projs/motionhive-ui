import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionsDetailStore } from './sessions-detail.store';
import { environment } from '../../environments/environment';

const BASE = environment.apiUrl;

function fakeTemplate(overrides: Partial<{ id: string; approvalRequired: boolean }> = {}): Record<string, unknown> {
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
    approvalRequired: overrides.approvalRequired ?? false,
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
    isRecurring: false,
    recurrenceRule: null,
    firstStartAt: '2026-12-01T10:00:00Z',
    status: 'ACTIVE',
    endedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function fakeInstance(): Record<string, unknown> {
  return {
    id: 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'usr-1',
    occurrenceIndex: 0,
    startAt: '2026-12-01T10:00:00Z',
    endAt: '2026-12-01T11:00:00Z',
    titleOverride: null,
    descriptionOverride: null,
    venueIdOverride: null,
    meetingUrlOverride: null,
    capacityOverride: null,
    isOverride: false,
    status: 'SCHEDULED',
    cancelReason: null,
    cancelledAt: null,
    confirmedCount: 1,
    pendingApprovalCount: 1,
    waitlistedCount: 0,
    attendedCount: null,
    conflictingInstanceIds: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    template: fakeTemplate(),
  };
}

function fakeParticipant(overrides: Partial<{ id: string; status: string; attended: boolean | null }> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 'p-1',
    instanceId: 'inst-1',
    userId: 'u-1',
    status: overrides.status ?? 'PENDING_APPROVAL',
    attended: overrides.attended ?? null,
    checkedInAt: null,
    bookingNote: null,
    snapshotPriceCents: 0,
    snapshotCurrency: 'RON',
    snapshotCancelCutoffH: 24,
    snapshotLocationText: null,
    snapshotMeetingUrl: null,
    bookedAt: '2026-01-01T00:00:00Z',
    approvedAt: null,
    declinedAt: null,
    cancelledAt: null,
    cancelReason: null,
    waitlistPosition: null,
  };
}

describe('SessionsDetailStore', () => {
  let store: SessionsDetailStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionsDetailStore,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(SessionsDetailStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushLoad(): void {
    const instReq = httpMock.expectOne(`${BASE}/sessions/instances/inst-1`);
    instReq.flush(fakeInstance());
    const partReq = httpMock.expectOne((r) =>
      r.url === `${BASE}/sessions/instances/inst-1/participants`,
    );
    partReq.flush({
      items: [
        fakeParticipant({ id: 'p-1', status: 'CONFIRMED', attended: true }),
        fakeParticipant({ id: 'p-2', status: 'PENDING_APPROVAL' }),
        fakeParticipant({ id: 'p-3', status: 'CONFIRMED', attended: false }),
      ],
      total: 3,
      page: 1,
      pageSize: 100,
    });
  }

  it('load() pulls instance + participants in parallel', () => {
    store.load('inst-1');
    flushLoad();
    expect(store.instance()).toBeTruthy();
    expect(store.template()?.id).toBe('tmpl-1');
    expect(store.participants().length).toBe(3);
  });

  it('counts() derives confirmed/pending/attended/no-show', () => {
    store.load('inst-1');
    flushLoad();
    const c = store.counts();
    expect(c.confirmed).toBe(2);
    expect(c.pending).toBe(1);
    expect(c.attended).toBe(1);
    expect(c.noShow).toBe(1);
  });

  it('approve() optimistically flips status to CONFIRMED', () => {
    store.load('inst-1');
    flushLoad();
    store.approve('p-2');
    const req = httpMock.expectOne(
      `${BASE}/sessions/instances/inst-1/participants/p-2/approve`,
    );
    req.flush({ status: 'CONFIRMED' });
    const p = store.participants().find((x) => x.id === 'p-2');
    expect(p?.status).toBe('CONFIRMED');
  });

  it('setAttendance() updates the row from server response', () => {
    store.load('inst-1');
    flushLoad();
    store.setAttendance('p-2', true);
    const req = httpMock.expectOne(
      `${BASE}/sessions/instances/inst-1/participants/p-2`,
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ attended: true });
    req.flush({ ...fakeParticipant({ id: 'p-2', status: 'CONFIRMED', attended: true }) });
    const p = store.participants().find((x) => x.id === 'p-2');
    expect(p?.attended).toBe(true);
  });

  it('error path: instance fetch failure surfaces store.error', () => {
    store.load('inst-1');
    const instReq = httpMock.expectOne(`${BASE}/sessions/instances/inst-1`);
    instReq.error(new ProgressEvent('Network'), { status: 500 });
    httpMock
      .expectOne((r) => r.url === `${BASE}/sessions/instances/inst-1/participants`)
      .flush({ items: [], total: 0, page: 1, pageSize: 100 });
    expect(store.error()).toBeTruthy();
    expect(store.instance()).toBeNull();
  });
});
