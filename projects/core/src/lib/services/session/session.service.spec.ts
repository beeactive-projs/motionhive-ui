import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionService } from './session.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

describe('SessionService', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ─── Templates ─────────────────────────────────────────────────────

  it('previewRecurrence → POST /sessions/templates/preview-recurrence', () => {
    service
      .previewRecurrence({
        rule: { frequency: 'DAILY', interval: 1, endAfterOccurrences: 3 },
        firstStartAt: '2026-06-01T18:00:00Z',
        timezone: 'Europe/Bucharest',
      })
      .subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates/preview-recurrence`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.timezone).toBe('Europe/Bucharest');
    req.flush({ occurrences: [], truncated: false });
  });

  it('createTemplate → POST /sessions/templates', () => {
    service
      .createTemplate({
        title: 'Yoga',
        type: 'OPEN',
        access: 'FREE',
        locationKind: 'ONLINE',
        meetingUrl: 'https://meet.google.com/abc',
        durationMinutes: 60,
        timezone: 'Europe/Bucharest',
        isRecurring: false,
        firstStartAt: '2026-06-15T07:00:00Z',
      })
      .subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates`);
    expect(req.request.method).toBe('POST');
    req.flush({ template: {}, generatedInstances: [], warnings: [] });
  });

  it('listTemplates → GET /sessions/templates with query params', () => {
    service.listTemplates({ tab: 'active', page: 2, limit: 50 }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${BASE}/sessions/templates`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tab')).toBe('active');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ items: [], total: 0, page: 2, pageSize: 50 });
  });

  it('getTemplate → GET /sessions/templates/:id', () => {
    service.getTemplate('tmpl-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates/tmpl-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updateTemplate → PATCH /sessions/templates/:id', () => {
    service.updateTemplate('tmpl-1', { title: 'New title' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates/tmpl-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.title).toBe('New title');
    req.flush({});
  });

  it('deleteTemplate → DELETE /sessions/templates/:id', () => {
    service.deleteTemplate('tmpl-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates/tmpl-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('regenerate → POST /sessions/templates/:id/regenerate', () => {
    service.regenerate('tmpl-1', { count: 5 }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/templates/tmpl-1/regenerate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.count).toBe(5);
    req.flush({ generatedInstances: [], warnings: [] });
  });

  // ─── Instances ─────────────────────────────────────────────────────

  it('listInstances → GET /sessions/instances with date range', () => {
    service
      .listInstances({
        dateFrom: '2026-06-01T00:00:00Z',
        dateTo: '2026-06-08T00:00:00Z',
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/instances`);
    expect(req.request.params.get('dateFrom')).toBe('2026-06-01T00:00:00Z');
    expect(req.request.params.get('dateTo')).toBe('2026-06-08T00:00:00Z');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('getInstance → GET /sessions/instances/:id', () => {
    service.getInstance('inst-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('listInstanceParticipants → GET /sessions/instances/:id/participants', () => {
    service.listInstanceParticipants('inst-1', { status: 'CONFIRMED' }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${BASE}/sessions/instances/inst-1/participants`,
    );
    expect(req.request.params.get('status')).toBe('CONFIRMED');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('cancelInstance → POST .../cancel with scope', () => {
    service.cancelInstance('inst-1', { scope: 'thisAndFuture', reason: 'sick' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.scope).toBe('thisAndFuture');
    req.flush({ scope: 'thisAndFuture', cancelledInstanceIds: [], notifiedUserIds: [] });
  });

  it('rescheduleInstance → POST .../reschedule', () => {
    service.rescheduleInstance('inst-1', { newStartAt: '2026-06-15T08:00:00Z' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/reschedule`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('patchInstance → PATCH /sessions/instances/:id', () => {
    service.patchInstance('inst-1', { titleOverride: 'Custom' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('followUp → POST .../follow-up', () => {
    service.followUp('inst-1', { audience: 'all', message: 'Thanks' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/follow-up`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.audience).toBe('all');
    req.flush({ notifiedUserIds: [] });
  });

  // ─── Booking ───────────────────────────────────────────────────────

  it('book → POST .../book', () => {
    service.book('inst-1', { bookingNote: 'excited' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/book`);
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'CONFIRMED', participantId: 'p-1' });
  });

  it('cancelBooking → POST .../cancel-booking', () => {
    service.cancelBooking('inst-1', { reason: 'conflict' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/cancel-booking`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('approveParticipant → POST .../participants/:pid/approve', () => {
    service.approveParticipant('inst-1', 'p-1').subscribe();
    const req = httpMock.expectOne(
      `${BASE}/sessions/instances/inst-1/participants/p-1/approve`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'CONFIRMED' });
  });

  it('declineParticipant → POST .../participants/:pid/decline', () => {
    service.declineParticipant('inst-1', 'p-1', { reason: 'capacity' }).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/sessions/instances/inst-1/participants/p-1/decline`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('capacity');
    req.flush({ status: 'DECLINED' });
  });

  it('patchParticipant → PATCH /sessions/instances/:id/participants/:pid', () => {
    service.patchParticipant('inst-1', 'p-1', { attended: true }).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/sessions/instances/inst-1/participants/p-1`,
    );
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  // ─── Public surface ───────────────────────────────────────────────

  it('discover → GET /sessions/discover', () => {
    service.discover({ q: 'yoga' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/discover`);
    expect(req.request.params.get('q')).toBe('yoga');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('getPublicBySlug → GET /sessions/public/:handle/:slug', () => {
    service.getPublicBySlug('andrei', 'morning-yoga').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/public/andrei/morning-yoga`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getPublicInstance → GET /sessions/instances/:id/public', () => {
    service.getPublicInstance('inst-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/public`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // ─── Client utilities ─────────────────────────────────────────────

  it('listMy → GET /sessions/my', () => {
    service.listMy({ tab: 'upcoming' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/my`);
    expect(req.request.params.get('tab')).toBe('upcoming');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('myCounts → GET /sessions/my/counts', () => {
    service.myCounts().subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/my/counts`);
    expect(req.request.method).toBe('GET');
    req.flush({
      upcoming: 0,
      pendingApproval: 0,
      waitlisted: 0,
      past: 0,
      cancelled: 0,
    });
  });

  it('joinInfo → GET /sessions/instances/:id/join-info', () => {
    service.joinInfo('inst-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/join-info`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // ─── Audit Fix (Bug 7): downloadIcs uses HttpClient (auth-aware), not raw URL ─

  it('downloadIcs → GET .../ics via HttpClient (Bearer-tagged by interceptor)', () => {
    let downloaded = '';
    service.downloadIcs('inst-1').subscribe((ics) => (downloaded = ics));
    const req = httpMock.expectOne(`${BASE}/sessions/instances/inst-1/ics`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');
    req.flush('BEGIN:VCALENDAR\r\nEND:VCALENDAR');
    expect(downloaded).toContain('VCALENDAR');
  });

  // ─── Query param helper edge cases ────────────────────────────────

  it('listInstances → omits null/undefined query params', () => {
    service.listInstances({
      dateFrom: undefined,
      instructorId: undefined,
      templateId: 'tmpl-1',
    }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/sessions/instances`);
    expect(req.request.params.has('dateFrom')).toBe(false);
    expect(req.request.params.has('instructorId')).toBe(false);
    expect(req.request.params.get('templateId')).toBe('tmpl-1');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});
