import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  BlockedSessionInstance,
  MessagingStore,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SessionAccess,
  SessionInstanceStatus,
  SessionParticipant,
  SessionService,
} from 'core';

import { ClockService } from '../../../../_shared/services/clock.service';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { SendToService } from '../../../../_shared/services/send-to.service';
import { BookingDetail } from './booking-detail';
import { BookingDetailStore } from './booking-detail.store';

const HOUR = 3_600_000;

function session(patch: {
  startsIn?: number;
  confirmed?: number;
  pending?: number;
  capacity?: number | null;
  access?: SessionAccess;
  approvalRequired?: boolean;
}): PublicSessionInstance {
  const start = Date.now() + (patch.startsIn ?? 24 * HOUR);
  return {
    id: 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'coach-1',
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    status: SessionInstanceStatus.Scheduled,
    capacityOverride: null,
    confirmedCount: patch.confirmed ?? 0,
    pendingApprovalCount: patch.pending ?? 0,
    template: {
      id: 'tmpl-1',
      title: 'Morning run',
      access: patch.access ?? SessionAccess.Open,
      capacity: patch.capacity === undefined ? 10 : patch.capacity,
      approvalRequired: patch.approvalRequired ?? false,
      waitlistEnabled: false,
    },
  } as unknown as PublicSessionInstance;
}

function setup(instance: PublicSessionInstance | BlockedSessionInstance, url = '/tabs/discover/inst-1') {
  const store = {
    instance: signal<PublicSessionInstance | BlockedSessionInstance | null>(instance),
    booking: signal<SessionParticipant | null>(null),
    joinInfo: signal(null),
    load: vi.fn(),
  };
  const router = { url, navigate: vi.fn(() => Promise.resolve(true)) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: BookingDetailStore, useValue: store },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: router },
      { provide: ClockService, useValue: { now: signal(Date.now()), bump: vi.fn() } },
      { provide: SessionService, useValue: {} },
      {
        provide: MyBookingsIndexStore,
        useValue: { invalidate: vi.fn(), ensureLoaded: vi.fn(), hasBooking: () => false },
      },
      { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SendToService, useValue: { open: vi.fn() } },
      { provide: MessagingStore, useValue: { findDirectWith: () => null } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new BookingDetail());
  return { page, router };
}

describe('BookingDetail', () => {
  it('offers Book only before the session starts', () => {
    expect(setup(session({})).page.bookAction()).toBe('book');
    // Under way: Book used to show on a session that had already started.
    expect(setup(session({ startsIn: -10 * 60_000 })).page.bookAction()).toBeNull();
  });

  // The API books against confirmed plus pending seats.
  it('counts seats waiting for approval as taken', () => {
    const { page } = setup(session({ capacity: 10, confirmed: 8, pending: 2 }));
    expect(page.isFull()).toBe(true);
    expect(page.bookAction()).toBe('full');
    expect(page.spotsLabel()).toBe('mySessions.detail.spotsBooked');
  });

  it('asks rather than books when the coach approves each booking', () => {
    expect(setup(session({ approvalRequired: true })).page.needsApproval()).toBe(true);
    expect(setup(session({})).page.needsApproval()).toBe(false);
  });

  it('can send a free session into a chat, not a members-only one', () => {
    expect(setup(session({ access: SessionAccess.Free })).page.canSend()).toBe(true);
    expect(setup(session({ access: SessionAccess.GroupOnly })).page.canSend()).toBe(false);
  });

  it("opens a members-only session's group from outside it, in the same stack", () => {
    const blocked = {
      id: 'inst-1',
      isBlocked: true,
      template: { id: 'tmpl-1', groupId: 'g-1', title: 'Members run' },
    } as unknown as BlockedSessionInstance;
    const { page, router } = setup(blocked);
    page.openGroup();
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/discover/groups', 'preview', 'g-1']);
  });
});
