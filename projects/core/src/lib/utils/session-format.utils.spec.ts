/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type { SessionInstance } from '../models/session/session.model';
import {
  bookingCancelBy,
  formatTimeUntil,
  formatTotalDuration,
  isLateCancel,
  joinPhase,
  joinWindowFor,
  sessionMinutes,
} from './session-format.utils';

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = new Date('2026-05-21T09:00:00Z').getTime();

/** `NOW` shifted by `ms`, as an ISO string. */
function at(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** Only the fields these helpers read — the full DTO is 30 fields of noise. */
function instance(overrides: Partial<SessionInstance>): SessionInstance {
  return {
    startAt: at(0),
    endAt: at(HOUR),
    ...overrides,
  } as SessionInstance;
}

describe('formatTimeUntil', () => {
  // The whole point of the helper: a row that says "next in 18 min".
  it('reads in minutes inside the hour', () => {
    expect(formatTimeUntil(at(18 * MINUTE), NOW)).toBe('in 18 min');
    expect(formatTimeUntil(at(MINUTE), NOW)).toBe('in 1 min');
  });

  it('switches to hours at the hour mark, not at 60 minutes of rounding', () => {
    // 59m40s rounds to 60 minutes — it must not render "in 60 min".
    expect(formatTimeUntil(at(59 * MINUTE + 40_000), NOW)).toBe('in 1 h');
    expect(formatTimeUntil(at(3 * HOUR), NOW)).toBe('in 3 h');
  });

  it('says "starting now" under a minute rather than "in 0 min"', () => {
    expect(formatTimeUntil(at(30_000), NOW)).toBe('starting now');
  });

  // Three distinct "render nothing" cases, all collapsing to null so callers
  // need one check rather than three.
  it('returns null once started — lifecycle owns that label, not this', () => {
    expect(formatTimeUntil(at(0), NOW)).toBeNull();
    expect(formatTimeUntil(at(-5 * MINUTE), NOW)).toBeNull();
  });

  it('returns null past eight hours, where a countdown is noise', () => {
    expect(formatTimeUntil(at(8 * HOUR), NOW)).toBe('in 8 h');
    expect(formatTimeUntil(at(9 * HOUR), NOW)).toBeNull();
  });

  it('returns null for missing or unparseable timestamps', () => {
    expect(formatTimeUntil(null, NOW)).toBeNull();
    expect(formatTimeUntil(undefined, NOW)).toBeNull();
    expect(formatTimeUntil('not a date', NOW)).toBeNull();
  });
});

describe('sessionMinutes', () => {
  // Measured from the instants: a list response can omit the template
  // entirely, so reading durationMinutes first would return 0 for real rows.
  it('measures the instants, ignoring the template when both exist', () => {
    const inst = instance({
      endAt: at(90 * MINUTE),
      template: { durationMinutes: 60 } as SessionInstance['template'],
    });
    expect(sessionMinutes(inst)).toBe(90);
  });

  it('works with no template at all', () => {
    expect(sessionMinutes(instance({ endAt: at(45 * MINUTE) }))).toBe(45);
  });

  it('falls back to the template only when the pair is unusable', () => {
    const inst = instance({
      endAt: 'not a date',
      template: { durationMinutes: 60 } as SessionInstance['template'],
    });
    expect(sessionMinutes(inst)).toBe(60);
  });

  it('returns 0 rather than NaN when nothing is usable', () => {
    expect(sessionMinutes(instance({ endAt: 'not a date' }))).toBe(0);
  });
});

describe('formatTotalDuration', () => {
  it('reads in hours once past one, dropping a zero remainder', () => {
    expect(formatTotalDuration(360)).toBe('6h');
    expect(formatTotalDuration(390)).toBe('6h 30m');
  });

  it('stays in minutes below the hour', () => {
    expect(formatTotalDuration(45)).toBe('45m');
    expect(formatTotalDuration(0)).toBe('0m');
  });

  it('never renders a negative total', () => {
    expect(formatTotalDuration(-30)).toBe('0m');
  });
});

describe('joinWindowFor / joinPhase', () => {
  // The window is the server's contract: start − 5 min → start + 15 min.
  it('derives the −5/+15 minute window from the start instant', () => {
    const { from, until } = joinWindowFor(at(0));
    expect(from.getTime()).toBe(NOW - 5 * MINUTE);
    expect(until.getTime()).toBe(NOW + 15 * MINUTE);
  });

  it('is before the window until the −5 min boundary, open exactly at it', () => {
    const { from, until } = joinWindowFor(at(5 * MINUTE));
    expect(joinPhase(from, until, NOW - 1)).toBe('before');
    expect(joinPhase(from, until, NOW)).toBe('open');
  });

  it('closes exactly at start + 15 min, not a moment sooner', () => {
    const { from, until } = joinWindowFor(at(0));
    expect(joinPhase(from, until, NOW + 15 * MINUTE - 1)).toBe('open');
    expect(joinPhase(from, until, NOW + 15 * MINUTE)).toBe('closed');
  });

  it('reads ISO strings straight off JoinInfo', () => {
    expect(joinPhase(at(-5 * MINUTE), at(15 * MINUTE), NOW)).toBe('open');
  });
});

describe('bookingCancelBy / isLateCancel', () => {
  // Always the as-booked snapshot cutoff — the maths must not care where the
  // hours came from, only that start − N h is the deadline.
  it('puts the deadline the cutoff ahead of start', () => {
    expect(bookingCancelBy(at(48 * HOUR), 24)?.getTime()).toBe(NOW + 24 * HOUR);
  });

  it('returns null for terms with no cutoff — cancel any time, no deadline', () => {
    expect(bookingCancelBy(at(48 * HOUR), 0)).toBeNull();
    expect(bookingCancelBy(at(48 * HOUR), -1)).toBeNull();
  });

  it('flags late only past the deadline — exactly at it is still on time', () => {
    const start = at(24 * HOUR);
    expect(isLateCancel(start, 24, NOW)).toBe(false); // exactly at the cutoff
    expect(isLateCancel(start, 24, NOW + 1)).toBe(true);
  });

  it('is never late when the terms have no cutoff', () => {
    expect(isLateCancel(at(-HOUR), 0, NOW)).toBe(false);
  });
});
