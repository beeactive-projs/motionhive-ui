import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  AppModeStore,
  AuthStore,
  ClientPaymentService,
  ClientService,
  EarningsService,
  NotificationStore,
} from 'core';

import { MoreBadgesService } from './more-badges.service';

function setup() {
  const unreadCount = signal(0);
  const getPendingRequestsCount = vi.fn(() =>
    of({ count: 1, incoming: 1, outgoing: 0, invitations: 0 }),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: { isInstructor: signal(true) } },
      { provide: AppModeStore, useValue: { mode: signal('coach') } },
      {
        provide: ClientPaymentService,
        useValue: { getMyCounts: () => of({ invoices: { open: 0 } }) },
      },
      { provide: ClientService, useValue: { getPendingRequestsCount } },
      { provide: EarningsService, useValue: { getSummary: () => of({ overdueInvoiceCount: 0 }) } },
      { provide: NotificationStore, useValue: { unreadCount } },
    ],
  });
  const badges = TestBed.inject(MoreBadgesService);
  TestBed.tick();
  return { badges, unreadCount, getPendingRequestsCount };
}

describe('MoreBadgesService', () => {
  it('counts again when a notification arrives, even within the fresh window', () => {
    const { badges, unreadCount, getPendingRequestsCount } = setup();
    badges.refresh();
    expect(getPendingRequestsCount).toHaveBeenCalledTimes(1);

    // A request arrives: the bell's unread count rises.
    unreadCount.set(1);
    TestBed.tick();

    expect(getPendingRequestsCount).toHaveBeenCalledTimes(2);
  });

  it('does not count again when notifications are only read', () => {
    const { unreadCount, getPendingRequestsCount } = setup();
    unreadCount.set(3);
    TestBed.tick();
    const calls = getPendingRequestsCount.mock.calls.length;

    unreadCount.set(1);
    TestBed.tick();

    expect(getPendingRequestsCount).toHaveBeenCalledTimes(calls);
  });

  it('a forced refresh skips the freshness window', () => {
    const { badges, getPendingRequestsCount } = setup();
    badges.refresh();
    badges.refresh();
    expect(getPendingRequestsCount).toHaveBeenCalledTimes(1);

    badges.refresh(true);
    expect(getPendingRequestsCount).toHaveBeenCalledTimes(2);
  });
});
