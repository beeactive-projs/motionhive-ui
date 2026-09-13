/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type {
  BlockedSessionInstance,
  PublicSessionInstance,
  SessionParticipant,
} from 'core';
import { SessionParticipantStatus } from 'core';

import {
  DetailViews,
  MY_SESSION_ICONS,
  MyBookingTones,
  bookingChip,
  bookingMeta,
  bookingPriceLabel,
  bookingTone,
  cancelSheetVariant,
  detailView,
  showJoinPill,
} from './my-sessions.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Component sources too — the detail screen picks band icons in TypeScript. */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Icon names this feature can render — static attributes, kebab literals in
 * bindings, and `icon:`/`'…-outline'` literals assembled in TypeScript
 * (bands, tiles). Same guard as the coach feature's `sessions.config.spec`.
 */
function iconNamesUsed(): string[] {
  const names = new Set<string>();

  for (const html of Object.values(templates)) {
    for (const match of html.matchAll(/\b(?:name|icon)="([a-z][a-z0-9-]*)"/g)) {
      names.add(match[1]);
    }
    for (const binding of html.matchAll(/\[(?:name|icon)\]="([^"]*)"/g)) {
      for (const literal of binding[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        names.add(literal[1]);
      }
    }
  }

  for (const ts of Object.values(sources)) {
    for (const match of ts.matchAll(/\bicon: '([a-z][a-z0-9-]*)'/g)) {
      names.add(match[1]);
    }
    // Band/tile icons are plain string literals ending in -outline.
    for (const match of ts.matchAll(/'([a-z][a-z-]*-outline)'/g)) {
      names.add(match[1]);
    }
  }

  return [...names];
}

const registered = new Set(Object.keys(MY_SESSION_ICONS));

describe('MY_SESSION_ICONS', () => {
  it('registers every icon the trainee screens render', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(
        toCamelCase(name),
      );
    }
  });

  it('registers nothing the screens do not use', () => {
    const used = new Set(iconNamesUsed().map(toCamelCase));

    for (const key of registered) {
      expect(used, `${key} is registered but unused`).toContain(key);
    }
  });
});

// ─── Fixtures ──────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-21T09:00:00Z').getTime();
const MINUTE = 60_000;
const HOUR = 3_600_000;

function at(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

/** Only the fields the helpers read — the full DTO is 30 fields of noise. */
function participant(overrides: Record<string, unknown> = {}): SessionParticipant {
  return {
    id: 'p-1',
    instanceId: 'i-1',
    status: SessionParticipantStatus.Confirmed,
    attended: null,
    snapshotPriceCents: 5000,
    snapshotCurrency: 'RON',
    snapshotCancelCutoffH: 24,
    snapshotLocationText: null,
    snapshotMeetingUrl: null,
    bookedAt: at(-72 * HOUR),
    waitlistPosition: null,
    instance: {
      id: 'i-1',
      startAt: at(2 * HOUR),
      endAt: at(3 * HOUR),
      status: 'SCHEDULED',
      titleOverride: null,
      confirmedCount: 5,
      instructor: { id: 'u-coach', firstName: 'Ana', lastName: 'Ionescu' },
      venueOverride: { id: 'v-1', name: 'Herăstrău loop', city: 'Bucharest' },
      template: {
        title: 'Run club',
        locationKind: 'IN_PERSON',
        durationMinutes: 90,
      },
    },
    ...overrides,
  } as unknown as SessionParticipant;
}

function online(overrides: Record<string, unknown> = {}): SessionParticipant {
  const base = participant(overrides);
  const instance = base.instance as unknown as Record<string, unknown>;
  instance['template'] = {
    ...(instance['template'] as object),
    locationKind: 'ONLINE',
    meetingProvider: 'GOOGLE_MEET',
  };
  instance['venueOverride'] = null;
  return base;
}

function publicInstance(
  overrides: Record<string, unknown> = {},
): PublicSessionInstance {
  const base = participant().instance as unknown as Record<string, unknown>;
  return { ...base, ...overrides } as unknown as PublicSessionInstance;
}

const blocked = {
  id: 'i-1',
  startAt: at(2 * HOUR),
  endAt: at(3 * HOUR),
  status: 'SCHEDULED',
  template: { title: 'Track intervals', type: 'GROUP', access: 'GROUP_ONLY' },
  instructor: null,
  isBlocked: true,
} as unknown as BlockedSessionInstance;

// ─── Spine tone ────────────────────────────────────────────────────────────

describe('bookingTone', () => {
  it('keys the spine to the booking status, not the session type', () => {
    expect(bookingTone(participant(), NOW)).toBe(MyBookingTones.Booked);
    expect(
      bookingTone(participant({ status: SessionParticipantStatus.PendingApproval }), NOW),
    ).toBe(MyBookingTones.Pending);
    expect(
      bookingTone(participant({ status: SessionParticipantStatus.Waitlisted }), NOW),
    ).toBe(MyBookingTones.Waitlist);
  });

  it('mutes what is over or dead, whatever its status was', () => {
    const past = {
      instance: {
        ...(participant().instance as object),
        startAt: at(-3 * HOUR),
        endAt: at(-2 * HOUR),
      },
    };
    expect(bookingTone(participant(past), NOW)).toBe(MyBookingTones.Muted);
    expect(
      bookingTone(participant({ status: SessionParticipantStatus.Cancelled }), NOW),
    ).toBe(MyBookingTones.Muted);
    expect(
      bookingTone(participant({ status: SessionParticipantStatus.Declined }), NOW),
    ).toBe(MyBookingTones.Muted);
  });

  it('keeps a live confirmed session on the booked tone — the Join moment', () => {
    const live = {
      instance: {
        ...(participant().instance as object),
        startAt: at(-10 * MINUTE),
        endAt: at(50 * MINUTE),
      },
    };
    expect(bookingTone(participant(live), NOW)).toBe(MyBookingTones.Booked);
  });
});

// ─── Chip ──────────────────────────────────────────────────────────────────

describe('bookingChip', () => {
  // The design's loudest rule: the default state is silent.
  it('gives a booked upcoming row NO chip', () => {
    expect(bookingChip(participant(), NOW)).toBeNull();
  });

  it('labels the exceptions', () => {
    expect(
      bookingChip(participant({ status: SessionParticipantStatus.PendingApproval }), NOW),
    ).toEqual({ label: 'Awaiting approval', tone: 'warn' });
    expect(
      bookingChip(participant({ status: SessionParticipantStatus.Waitlisted }), NOW),
    ).toEqual({ label: 'Waitlist', tone: 'info' });
  });

  // The backend column is always null and arrival order is all that exists —
  // even if a number ever appeared, the chip must not surface it.
  it('never renders a queue position', () => {
    const chip = bookingChip(
      participant({ status: SessionParticipantStatus.Waitlisted, waitlistPosition: 3 }),
      NOW,
    );
    expect(chip?.label).toBe('Waitlist');
    expect(chip?.label).not.toContain('3');
  });

  it('turns into the attendance record once the session is over', () => {
    const past = (attended: boolean | null) =>
      participant({
        attended,
        instance: {
          ...(participant().instance as object),
          startAt: at(-3 * HOUR),
          endAt: at(-2 * HOUR),
        },
      });
    expect(bookingChip(past(true), NOW)).toEqual({ label: 'Attended', tone: 'success' });
    expect(bookingChip(past(false), NOW)).toEqual({ label: 'Missed', tone: 'medium' });
    // No mark yet — the design costs nothing without it.
    expect(bookingChip(past(null), NOW)).toBeNull();
  });

  it('names cancelled and declined for the ghost list, muted', () => {
    expect(
      bookingChip(participant({ status: SessionParticipantStatus.Cancelled }), NOW),
    ).toEqual({ label: 'Cancelled', tone: 'medium' });
    expect(
      bookingChip(participant({ status: SessionParticipantStatus.Declined }), NOW),
    ).toEqual({ label: 'Declined', tone: 'medium' });
  });
});

// ─── Meta ──────────────────────────────────────────────────────────────────

describe('bookingMeta', () => {
  it('reads "with {coach} · {place}"', () => {
    expect(bookingMeta(participant())).toBe('with Ana · Herăstrău loop');
  });

  it('says Online for an online session', () => {
    expect(bookingMeta(online())).toBe('with Ana · Online');
  });

  it('survives missing eager refs without leaving separators behind', () => {
    const bare = participant({
      instance: {
        ...(participant().instance as object),
        instructor: undefined,
        venueOverride: null,
        template: { title: 'Run club', locationKind: 'IN_PERSON' },
      },
      snapshotLocationText: null,
    });
    expect(bookingMeta(bare)).toBe('');
  });
});

// ─── Join pill ─────────────────────────────────────────────────────────────

describe('showJoinPill', () => {
  const liveOnline = () =>
    online({
      instance: {
        ...(online().instance as object),
        startAt: at(-2 * MINUTE),
        endAt: at(28 * MINUTE),
      },
    });

  it('shows for a confirmed online booking inside the window', () => {
    expect(showJoinPill(liveOnline(), NOW)).toBe(true);
  });

  it('opens at start−5 min exactly, closes at start+15', () => {
    const startsSoon = online({
      instance: { ...(online().instance as object), startAt: at(5 * MINUTE), endAt: at(35 * MINUTE) },
    });
    expect(showJoinPill(startsSoon, NOW)).toBe(true);
    expect(showJoinPill(startsSoon, NOW - 1)).toBe(false);

    const startedAWhileAgo = online({
      instance: { ...(online().instance as object), startAt: at(-15 * MINUTE), endAt: at(15 * MINUTE) },
    });
    expect(showJoinPill(startedAWhileAgo, NOW)).toBe(false);
  });

  it('never shows for in-person, unconfirmed, or a cancelled occurrence', () => {
    const inPerson = participant({
      instance: { ...(participant().instance as object), startAt: at(-2 * MINUTE), endAt: at(58 * MINUTE) },
    });
    expect(showJoinPill(inPerson, NOW)).toBe(false);
    expect(
      showJoinPill(
        { ...liveOnline(), status: SessionParticipantStatus.Waitlisted } as SessionParticipant,
        NOW,
      ),
    ).toBe(false);
    const cancelledInstance = online({
      instance: {
        ...(online().instance as object),
        startAt: at(-2 * MINUTE),
        endAt: at(28 * MINUTE),
        status: 'CANCELLED',
      },
    });
    expect(showJoinPill(cancelledInstance, NOW)).toBe(false);
  });
});

// ─── Detail state machine ──────────────────────────────────────────────────

describe('detailView', () => {
  const confirmed = () => participant();
  const confirmedOnline = () => online();

  it('redaction and coach-cancelled outrank everything', () => {
    expect(detailView(blocked, confirmed(), null, NOW)).toBe(DetailViews.Blocked);
    expect(
      detailView(publicInstance({ status: 'CANCELLED' }), confirmed(), null, NOW),
    ).toBe(DetailViews.CancelledInstance);
  });

  it('books an in-person seat until it is over, then records it', () => {
    expect(detailView(publicInstance(), confirmed(), null, NOW)).toBe(
      DetailViews.BookedInPerson,
    );
    const over = publicInstance({ startAt: at(-3 * HOUR), endAt: at(-2 * HOUR) });
    expect(detailView(over, confirmed(), null, NOW)).toBe(DetailViews.Past);
  });

  it('flips online from pre to live exactly when the window opens', () => {
    const instance = publicInstance({
      startAt: at(4 * MINUTE),
      endAt: at(34 * MINUTE),
      template: { title: 'HIIT 30', locationKind: 'ONLINE' },
    });
    const booking = confirmedOnline();
    // 17:54 → 17:55 in the design: one minute apart, two different screens.
    expect(detailView(instance, booking, null, NOW - MINUTE - 1)).toBe(
      DetailViews.OnlinePre,
    );
    expect(detailView(instance, booking, null, NOW - MINUTE)).toBe(
      DetailViews.OnlineLive,
    );
  });

  it('decays online to a record at start+15, even mid-class', () => {
    const instance = publicInstance({
      startAt: at(-16 * MINUTE),
      endAt: at(14 * MINUTE),
      template: { title: 'HIIT 30', locationKind: 'ONLINE' },
    });
    expect(detailView(instance, confirmedOnline(), null, NOW)).toBe(DetailViews.Past);
  });

  it('prefers the server window over the derived one when joinInfo answered', () => {
    const instance = publicInstance({
      startAt: at(4 * MINUTE),
      endAt: at(34 * MINUTE),
      template: { title: 'HIIT 30', locationKind: 'ONLINE' },
    });
    const serverWindow = {
      meetingUrl: 'https://meet.google.com/abc',
      joinActiveFrom: at(10 * MINUTE),
      joinActiveUntil: at(30 * MINUTE),
      instructorJoined: false,
    };
    // Derived window says open; the server says not yet — the server wins.
    expect(detailView(instance, confirmedOnline(), serverWindow, NOW)).toBe(
      DetailViews.OnlinePre,
    );
  });

  it('routes pending and waitlisted to their own screens while ahead', () => {
    expect(
      detailView(
        publicInstance(),
        participant({ status: SessionParticipantStatus.PendingApproval }),
        null,
        NOW,
      ),
    ).toBe(DetailViews.Pending);
    expect(
      detailView(
        publicInstance(),
        participant({ status: SessionParticipantStatus.Waitlisted }),
        null,
        NOW,
      ),
    ).toBe(DetailViews.Waitlist);
  });

  it('shows the public showcase without a booking, or after one died', () => {
    expect(detailView(publicInstance(), null, null, NOW)).toBe(DetailViews.Showcase);
    expect(
      detailView(
        publicInstance(),
        participant({ status: SessionParticipantStatus.Cancelled }),
        null,
        NOW,
      ),
    ).toBe(DetailViews.Showcase);
  });
});

// ─── Price + cancel variants ───────────────────────────────────────────────

describe('bookingPriceLabel', () => {
  it('reads whole amounts without decimals, and Free at zero', () => {
    expect(bookingPriceLabel(5000, 'RON')).toBe('50 RON');
    expect(bookingPriceLabel(4950, 'ron')).toBe('49.50 RON');
    expect(bookingPriceLabel(0, 'RON')).toBe('Free');
  });
});

describe('cancelSheetVariant', () => {
  it('keys the copy to what is actually being given up', () => {
    expect(cancelSheetVariant(SessionParticipantStatus.Confirmed).title).toBe(
      'Cancel this booking?',
    );
    expect(cancelSheetVariant(SessionParticipantStatus.Waitlisted).title).toBe(
      'Leave the waitlist?',
    );
    expect(cancelSheetVariant(SessionParticipantStatus.PendingApproval).title).toBe(
      'Withdraw request?',
    );
  });

  it('shows terms only for a confirmed seat — no terms apply elsewhere', () => {
    expect(cancelSheetVariant(SessionParticipantStatus.Confirmed).showTerms).toBe(true);
    expect(cancelSheetVariant(SessionParticipantStatus.Waitlisted).showTerms).toBe(false);
    expect(cancelSheetVariant(SessionParticipantStatus.PendingApproval).showTerms).toBe(
      false,
    );
  });

  it('falls back to the confirmed variant for anything unexpected', () => {
    expect(cancelSheetVariant(null).saveLabel).toBe('Cancel booking');
  });
});
