import { describe, expect, it } from 'vitest';
import type { SessionInstance } from 'core';
import { instanceToCalendarEvent } from './mappers';

function fakeInstance(
  overrides: Partial<{
    id: string;
    startAt: string;
    titleOverride: string | null;
    conflictingInstanceIds: string[] | null;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    template: Partial<{
      title: string;
      type: 'GROUP' | 'PRIVATE' | 'OPEN';
      locationKind: 'IN_PERSON' | 'ONLINE';
      meetingProvider: 'ZOOM' | 'GOOGLE_MEET' | 'TEAMS' | null;
      isRecurring: boolean;
    }>;
  }> = {},
): SessionInstance {
  return {
    id: overrides.id ?? 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'usr-1',
    occurrenceIndex: 0,
    startAt: overrides.startAt ?? '2026-12-01T10:00:00Z',
    endAt: '2026-12-01T11:00:00Z',
    titleOverride: overrides.titleOverride ?? null,
    descriptionOverride: null,
    venueIdOverride: null,
    meetingUrlOverride: null,
    capacityOverride: null,
    isOverride: false,
    status: overrides.status ?? 'SCHEDULED',
    cancelReason: null,
    cancelledAt: null,
    confirmedCount: 0,
    pendingApprovalCount: 0,
    waitlistedCount: 0,
    attendedCount: null,
    conflictingInstanceIds: overrides.conflictingInstanceIds ?? null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    template: {
      id: 'tmpl-1',
      slug: 'yoga',
      title: overrides.template?.title ?? 'Yoga',
      type: overrides.template?.type ?? 'OPEN',
      access: 'OPEN',
      approvalRequired: false,
      locationKind: overrides.template?.locationKind ?? 'IN_PERSON',
      meetingUrl: null,
      meetingProvider: overrides.template?.meetingProvider ?? null,
      durationMinutes: 60,
      timezone: 'Europe/Bucharest',
      capacity: 10,
      waitlistEnabled: true,
      cancellationCutoffHours: 24,
      priceAmountCents: 0,
      priceCurrency: 'RON',
      instructorId: 'usr-1',
      groupId: null,
      venueId: null,
      isRecurring: overrides.template?.isRecurring ?? false,
      recurrenceRule: null,
      firstStartAt: '2026-12-01T10:00:00Z',
      status: 'ACTIVE',
      endedAt: null,
      description: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

describe('instanceToCalendarEvent', () => {
  it('passes through id, start, end, title', () => {
    const e = instanceToCalendarEvent(fakeInstance());
    expect(e.id).toBe('inst-1');
    expect(e.start).toBeInstanceOf(Date);
    expect(e.end).toBeInstanceOf(Date);
    expect(e.title).toBe('Yoga');
  });

  it('uses titleOverride when present', () => {
    const e = instanceToCalendarEvent(fakeInstance({ titleOverride: 'Special class' }));
    expect(e.title).toBe('Special class');
  });

  it('maps type → color (GROUP/PRIVATE/OPEN)', () => {
    const group = instanceToCalendarEvent(fakeInstance({ template: { type: 'GROUP' } }));
    const priv = instanceToCalendarEvent(fakeInstance({ template: { type: 'PRIVATE' } }));
    const open = instanceToCalendarEvent(fakeInstance({ template: { type: 'OPEN' } }));
    expect(group.color).toContain('primary');
    expect(priv.color).toContain('#1D4ED8'); // navy hex
    expect(open.color).toContain('cyan');
  });

  it('online sessions get the "online" badge + provider subtitle', () => {
    const e = instanceToCalendarEvent(
      fakeInstance({
        template: { locationKind: 'ONLINE', meetingProvider: 'GOOGLE_MEET' },
      }),
    );
    expect(e.badges).toContain('online');
    expect(e.subtitle).toBe('Google Meet');
  });

  it('in-person sessions get venue name as subtitle', () => {
    const inst = fakeInstance();
    const e = instanceToCalendarEvent(inst);
    // No venue ref set → 'In-person' fallback
    expect(e.subtitle).toBe('In-person');
  });

  it('conflicting instance → ring=conflict', () => {
    const e = instanceToCalendarEvent(
      fakeInstance({ conflictingInstanceIds: ['other-id'] }),
    );
    expect(e.ring).toBe('conflict');
  });

  it('non-conflicting instance → ring=none', () => {
    const e = instanceToCalendarEvent(fakeInstance({ conflictingInstanceIds: null }));
    expect(e.ring).toBe('none');
  });

  it('recurring template → "recurring" badge', () => {
    const e = instanceToCalendarEvent(
      fakeInstance({ template: { isRecurring: true } }),
    );
    expect(e.badges).toContain('recurring');
  });

  it('CANCELLED instance → "cancelled" badge', () => {
    const e = instanceToCalendarEvent(fakeInstance({ status: 'CANCELLED' }));
    expect(e.badges).toContain('cancelled');
  });

  it('payload carries the original instance (round-trip safety)', () => {
    const inst = fakeInstance();
    const e = instanceToCalendarEvent(inst);
    expect(e.payload).toBe(inst);
  });
});
