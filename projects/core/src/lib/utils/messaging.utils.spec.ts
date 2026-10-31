import { describe, expect, it } from 'vitest';

import { MessageView } from '../models/messaging';
import {
  dayDividerLabel,
  dayInSentence,
  dayShortLabel,
  displayName,
  formatRelativeShort,
  groupMessages,
  initialsOf,
} from './messaging.utils';

function message(overrides: Partial<MessageView> & { id: string }): MessageView {
  return {
    conversationId: 'c1',
    senderId: 'u1',
    kind: 'TEXT',
    body: 'hi',
    deletedAt: null,
    createdAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('displayName / initialsOf', () => {
  it('joins the parts it has', () => {
    expect(displayName({ firstName: 'Ana', lastName: 'Niță' })).toBe('Ana Niță');
    expect(displayName({ firstName: 'Ana', lastName: null })).toBe('Ana');
  });

  it('falls back when there is nothing usable', () => {
    expect(displayName(null)).toBe('Unknown');
    expect(displayName({ firstName: '', lastName: '' }, 'this person')).toBe('this person');
    expect(initialsOf(null)).toBe('?');
  });

  it('builds initials from both names', () => {
    expect(initialsOf({ firstName: 'Ana', lastName: 'Bell' })).toBe('AB');
  });
});

describe('groupMessages', () => {
  it('marks a lone message as its own run', () => {
    const [bubble] = groupMessages([message({ id: 'a' })]);
    expect(bubble.position).toBe('only');
    expect(bubble.startsNewDay).toBe(true);
  });

  it('groups consecutive messages from one sender inside the gap', () => {
    const bubbles = groupMessages([
      message({ id: 'a', createdAt: '2026-08-10T12:00:00.000Z' }),
      message({ id: 'b', createdAt: '2026-08-10T12:01:00.000Z' }),
      message({ id: 'c', createdAt: '2026-08-10T12:02:00.000Z' }),
    ]);
    expect(bubbles.map((b) => b.position)).toEqual(['first', 'middle', 'last']);
  });

  it('breaks a run when the gap exceeds five minutes', () => {
    const bubbles = groupMessages([
      message({ id: 'a', createdAt: '2026-08-10T12:00:00.000Z' }),
      message({ id: 'b', createdAt: '2026-08-10T12:06:00.000Z' }),
    ]);
    expect(bubbles.map((b) => b.position)).toEqual(['only', 'only']);
  });

  it('breaks a run when the sender changes', () => {
    const bubbles = groupMessages([
      message({ id: 'a', senderId: 'u1' }),
      message({ id: 'b', senderId: 'u2', createdAt: '2026-08-10T12:00:30.000Z' }),
    ]);
    expect(bubbles.map((b) => b.position)).toEqual(['only', 'only']);
  });
});

describe('day keys are local, not UTC', () => {
  // The regression this guards: keying on `iso.slice(0, 10)` puts a late
  // evening message on tomorrow's date west of Greenwich, so one evening
  // renders two dividers and the later one reads "Today".
  it('keys a message by the calendar day the reader is in', () => {
    const evening = new Date(2026, 7, 10, 21, 30);
    const [bubble] = groupMessages([message({ id: 'a', createdAt: evening.toISOString() })]);
    expect(bubble.dayKey).toBe('2026-08-10');
  });

  it('keeps one evening on one divider', () => {
    const bubbles = groupMessages([
      message({ id: 'a', createdAt: new Date(2026, 7, 10, 20, 0).toISOString() }),
      message({ id: 'b', createdAt: new Date(2026, 7, 10, 23, 30).toISOString() }),
    ]);
    expect(bubbles[0].dayKey).toBe(bubbles[1].dayKey);
    expect(bubbles[1].startsNewDay).toBe(false);
  });

  it('labels today and yesterday relative to the reader', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    expect(dayDividerLabel(key(today))).toBe('Today');
    expect(dayDividerLabel(key(yesterday))).toBe('Yesterday');
  });

  it('renders an older key as its own local date', () => {
    // Not the day before, which is what UTC-midnight parsing would give.
    expect(dayDividerLabel('2026-08-10')).toContain('10');
  });

  it('is a label in sentence case, Romanian included', () => {
    // Romanian Intl writes "miercuri, 28 octombrie"; as a day heading it
    // must start with a capital, like "Azi" and "Ieri" above it.
    expect(dayDividerLabel('2026-10-28', 'ro-RO')).toBe('Miercuri, 28 octombrie');
    expect(dayDividerLabel('2026-08-10', 'en-US')).toBe('Monday, August 10');
  });
});

describe('dayInSentence', () => {
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('lowers today and yesterday for the middle of a sentence', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayInSentence(key(new Date()))).toBe('today');
    expect(dayInSentence(key(yesterday))).toBe('yesterday');
  });

  it('keeps the date in running-text case for each language', () => {
    expect(dayInSentence('2026-10-28', 'ro-RO')).toBe('miercuri, 28 octombrie');
    expect(dayInSentence('2026-08-10', 'en-US')).toBe('Monday, August 10');
  });
});

describe('dayShortLabel', () => {
  it('says today by name and an older day as day and short month', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(dayShortLabel(today)).toBe('Today');

    // Day 1 of this year's January: never today or yesterday unless the
    // test runs on 1 or 2 January, when it is one of those by name.
    const jan = `${now.getFullYear()}-01-01`;
    const label = dayShortLabel(jan, 'en-GB');
    if (!['Today', 'Yesterday'].includes(label)) expect(label).toBe('1 Jan');
    if (!['Today', 'Yesterday'].includes(label)) {
      expect(dayShortLabel(jan, 'ro-RO')).toBe('1 ian.');
    }
  });

  it('adds the year only for another year', () => {
    expect(dayShortLabel('2019-10-28', 'en-GB')).toBe('28 Oct 2019');
  });
});

describe('formatRelativeShort', () => {
  it('collapses sub-minute gaps and forward clock skew to "now"', () => {
    expect(formatRelativeShort(new Date().toISOString())).toBe('now');
    const skewed = new Date(Date.now() + 30_000).toISOString();
    expect(formatRelativeShort(skewed)).toBe('now');
  });

  it('counts minutes then hours', () => {
    expect(formatRelativeShort(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m');
    expect(formatRelativeShort(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3h');
  });

  it('returns empty for an unparseable timestamp', () => {
    expect(formatRelativeShort('not a date')).toBe('');
  });
});
