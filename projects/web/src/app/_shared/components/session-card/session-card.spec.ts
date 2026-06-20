import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SessionCard } from './session-card';

const futureIso = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function makeInstance(o: Partial<{ access: string; approvalRequired: boolean; locationKind: string; meetingProvider: string | null; signups: number; cap: number | null; isRecurring: boolean }> = {}): unknown {
  return {
    id: 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'usr-1',
    occurrenceIndex: 0,
    startAt: futureIso(2),
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
    confirmedCount: o.signups ?? 0,
    pendingApprovalCount: 0,
    waitlistedCount: 0,
    attendedCount: null,
    conflictingInstanceIds: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    template: {
      id: 'tmpl-1',
      slug: 'yoga',
      title: 'Yoga',
      type: 'OPEN',
      access: o.access ?? 'OPEN',
      approvalRequired: o.approvalRequired ?? false,
      locationKind: o.locationKind ?? 'ONLINE',
      meetingUrl: 'https://meet.google.com/x',
      meetingProvider: o.meetingProvider ?? 'GOOGLE_MEET',
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      capacity: o.cap ?? null,
      waitlistEnabled: true,
      cancellationCutoffHours: 24,
      priceAmountCents: 0,
      priceCurrency: 'RON',
      instructorId: 'usr-1',
      groupId: null,
      venueId: null,
      isRecurring: o.isRecurring ?? false,
      recurrenceRule: null,
      firstStartAt: futureIso(2),
      status: 'ACTIVE',
      endedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    },
  };
}

describe('SessionCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SessionCard] }).compileComponents();
  });

  it('renders OPEN session with "Book" CTA when caller is eligible', async () => {
    const fixture = TestBed.createComponent(SessionCard);
    fixture.componentRef.setInput('instance', makeInstance({ access: 'OPEN' }));
    fixture.componentRef.setInput('eligibility', 'eligible');
    fixture.detectChanges();
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Book');
  });

  it('renders CLIENTS_ONLY with "Become a client" when caller is not eligible', async () => {
    const fixture = TestBed.createComponent(SessionCard);
    fixture.componentRef.setInput('instance', makeInstance({ access: 'CLIENTS_ONLY' }));
    fixture.componentRef.setInput('eligibility', 'not-eligible');
    fixture.detectChanges();
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Become a client');
  });

  it('renders "Request to book" when approvalRequired=true', async () => {
    const fixture = TestBed.createComponent(SessionCard);
    fixture.componentRef.setInput(
      'instance',
      makeInstance({ access: 'OPEN', approvalRequired: true }),
    );
    fixture.componentRef.setInput('eligibility', 'eligible');
    fixture.detectChanges();
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Request to book');
  });

  it('renders blocked variant for BlockedSessionInstance', async () => {
    const blocked = {
      id: 'inst-1',
      templateId: 'tmpl-1',
      instructorId: 'usr-1',
      startAt: futureIso(2),
      endAt: futureIso(2),
      status: 'SCHEDULED',
      template: {
        id: 'tmpl-1',
        slug: 'private-class',
        title: 'Private class',
        type: 'GROUP',
        access: 'GROUP_ONLY',
        durationMinutes: 60,
        instructorId: 'usr-1',
        groupId: 'g-1',
      },
      instructor: null,
      isBlocked: true as const,
    };
    const fixture = TestBed.createComponent(SessionCard);
    fixture.componentRef.setInput('instance', blocked);
    fixture.detectChanges();
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Members only');
    expect(html).toContain('hidden');
  });
});
