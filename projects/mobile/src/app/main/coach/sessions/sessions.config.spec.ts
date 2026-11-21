/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type { SessionInstance, SessionTemplate } from 'core';

import {
  LOCATION_KIND_OPTIONS,
  SESSION_ACCESS_OPTIONS,
  SESSION_ACTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
  SessionActionIds,
  onTheRoster,
} from './sessions.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * The component sources too — the detail screen assembles its rows in
 * TypeScript (`detailRows`), so their icon names never appear in a template.
 */
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
 * Icon names this feature can render.
 *
 * Four sources, because a name reaches `ion-icon` four ways here: a static
 * attribute, a kebab literal inside a conditional binding, the `icon` field
 * on the option constants the create sheet iterates, and `icon:` literals on
 * rows components build in TypeScript — those last two live outside the
 * templates, so no amount of template scanning would find them.
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
  }

  for (const option of [
    ...SESSION_TYPE_OPTIONS,
    ...LOCATION_KIND_OPTIONS,
    ...SESSION_ACCESS_OPTIONS,
    ...SESSION_ACTIONS,
  ]) {
    if (option.icon) names.add(option.icon);
  }

  // Ionic's own components name these; we never register them.
  names.delete('crescent');
  return [...names];
}

const registered = new Set(Object.keys(SESSION_ICONS));

describe('SESSION_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as ACCOUNT_ICONS.
  it('registers every icon the sessions screens render', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });

  // The opposite drift: icons kept around for screens that changed.
  it('registers nothing the screens do not use', () => {
    const used = new Set(iconNamesUsed().map(toCamelCase));

    for (const key of registered) {
      expect(used, `${key} is registered but unused`).toContain(key);
    }
  });
});

describe('formatWeekdayList', () => {
  // The recurrence editor and the detail screen used to join this list
  // differently, so one series read two ways depending on the screen.
  it('reads as prose, in ISO order regardless of input order', async () => {
    const { formatWeekdayList } = await import('./sessions.config');
    expect(formatWeekdayList([1])).toBe('Mon');
    expect(formatWeekdayList([3, 1])).toBe('Mon & Wed');
    expect(formatWeekdayList([5, 1, 3])).toBe('Mon, Wed & Fri');
    expect(formatWeekdayList([7])).toBe('Sun');
  });

  it('returns empty for no days, so callers can pick their own copy', async () => {
    const { formatWeekdayList } = await import('./sessions.config');
    expect(formatWeekdayList([])).toBe('');
  });

  // 0=Sunday is the JS convention and the one bug this whole area invites.
  it('ignores values outside 1..7 rather than rendering undefined', async () => {
    const { formatWeekdayList } = await import('./sessions.config');
    expect(formatWeekdayList([0, 1, 8])).toBe('Mon');
  });
});

describe('formatRecurrenceSummary', () => {
  it('reads as the design does — how often, then when it stops', async () => {
    const { formatRecurrenceSummary } = await import('./sessions.config');
    expect(
      formatRecurrenceSummary({
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [2, 4],
        endAfterOccurrences: 24,
      }),
    ).toBe('Every Tue & Thu · 24 occurrences');
  });

  // A series with no end is not endless — the BE materialises a batch and tops
  // it up later — so the sentence has to stop at the frequency.
  it('says nothing about the end when the rule carries none', async () => {
    const { formatRecurrenceSummary } = await import('./sessions.config');
    expect(
      formatRecurrenceSummary({ frequency: 'WEEKLY', interval: 1, daysOfWeek: [1] }),
    ).toBe('Every Mon');
  });

  it('handles the non-weekly frequencies and intervals', async () => {
    const { formatRecurrenceSummary } = await import('./sessions.config');
    expect(formatRecurrenceSummary({ frequency: 'DAILY', interval: 1 })).toBe('Every day');
    expect(formatRecurrenceSummary({ frequency: 'MONTHLY', interval: 2 })).toBe(
      'Every 2 months',
    );
    expect(
      formatRecurrenceSummary({ frequency: 'WEEKLY', interval: 2, daysOfWeek: [3] }),
    ).toBe('Every 2 weeks on Wed');
  });

  it('ends on a date when that is how the rule ends', async () => {
    const { formatRecurrenceSummary } = await import('./sessions.config');
    expect(
      formatRecurrenceSummary({
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [5],
        endDate: '2026-06-30',
      }),
    ).toBe('Every Fri · until 30 Jun');
  });

  it('returns empty for a one-off, so callers can skip the line', async () => {
    const { formatRecurrenceSummary } = await import('./sessions.config');
    expect(formatRecurrenceSummary(null)).toBe('');
  });
});

describe('sessionTypeLabel', () => {
  // The chip on the detail band and the tile on the create sheet name the same
  // thing — core's SESSION_TYPES is the single list both read now.
  it('names a type the way the create sheet does', async () => {
    const { sessionTypeLabel } = await import('core');
    expect(sessionTypeLabel('GROUP')).toBe('Group');
    expect(sessionTypeLabel('PRIVATE')).toBe('1-on-1');
    expect(sessionTypeLabel('OPEN')).toBe('Open');
  });

  it('falls back rather than rendering an enum at a user', async () => {
    const { sessionTypeLabel } = await import('core');
    expect(sessionTypeLabel(null)).toBe('Session');
  });
});

describe('option constants', () => {
  // The BE expects ISO 8601 weekdays. Getting this wrong shifts an entire
  // recurring series by a day, which is invisible until someone turns up on
  // the wrong morning.
  it('keeps weekday values ISO 1=Mon..7=Sun', async () => {
    const { WEEKDAYS } = await import('./sessions.config');
    expect(WEEKDAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(WEEKDAYS[0].label).toBe('M');
    expect(WEEKDAYS[6].label).toBe('S');
  });

  it('offers only cancel scopes the API accepts', async () => {
    const { CANCEL_SCOPE_OPTIONS } = await import('./sessions.config');
    expect(CANCEL_SCOPE_OPTIONS.map((o) => o.value)).toEqual([
      'this',
      'thisAndFuture',
      'series',
    ]);
  });

  // A colour Ionic cannot resolve is not an error — the glyph silently falls
  // back to the item's ink, so a typo here shows up as one row quietly losing
  // its tint rather than as a failure.
  it('tints every verb with a palette colour Ionic knows', () => {
    const palette = ['primary', 'success', 'info', 'teal', 'violet', 'danger'];
    for (const action of SESSION_ACTIONS) {
      expect(palette).toContain(action.color);
    }
  });

  // Honey is the brand's "act here" colour, so one row per sheet may wear it.
  // Open is the agenda's and Edit the detail screen's; the sheet never shows
  // both (session-actions-sheet), so neither competes with the other.
  it('spends honey on Open and Edit alone', () => {
    const honey = SESSION_ACTIONS.filter((action) => action.color === 'primary');
    expect(honey.map((action) => action.id)).toEqual([SessionActionIds.Open, SessionActionIds.Edit]);
  });

  // Red label and red glyph both key off `destructive`, and cancel is the only
  // verb that cannot be undone.
  it('marks cancel, and only cancel, destructive', () => {
    const destructive = SESSION_ACTIONS.filter((action) => action.destructive);
    expect(destructive.map((action) => action.id)).toEqual([SessionActionIds.Cancel]);
    expect(destructive[0].color).toBe('danger');
  });
});

describe('prefillFromInstance', () => {
  const NOW = new Date('2026-05-21T09:00:00').getTime();

  /** Only the fields the mapper reads. */
  function instance(overrides: Record<string, unknown> = {}) {
    return {
      startAt: '2026-05-25T18:00:00',
      endAt: '2026-05-25T19:00:00',
      titleOverride: null,
      capacityOverride: null,
      meetingUrlOverride: null,
      venueIdOverride: null,
      confirmedCount: 0,
      pendingApprovalCount: 0,
      template: {
        title: 'Strength club',
        type: 'GROUP',
        locationKind: 'IN_PERSON',
        durationMinutes: 60,
        capacity: 14,
        priceAmountCents: 5000,
        meetingUrl: null,
        venueId: 'v-1',
        recurrenceRule: null,
      },
      ...overrides,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it('copies the template, converting price back out of cents', async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const out = prefillFromInstance(instance(), NOW);
    expect(out.title).toBe('Strength club');
    expect(out.capacity).toBe(14);
    expect(out.priceAmount).toBe(50);
    expect(out.venueId).toBe('v-1');
  });

  it('prefers the per-occurrence overrides over the template', async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const out = prefillFromInstance(
      instance({ titleOverride: 'Strength club · extra', capacityOverride: 20 }),
      NOW,
    );
    expect(out.title).toBe('Strength club · extra');
    expect(out.capacity).toBe(20);
  });

  it('keeps a future start exactly where it is', async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const out = prefillFromInstance(instance(), NOW);
    expect(out.startAt).toBe('2026-05-25T18:00');
  });

  // Duplicating a past session must not propose a start in the past — the API
  // refuses it. Same weekday, same time, next time round.
  it('rolls a past start forward in whole weeks', async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const out = prefillFromInstance(
      instance({ startAt: '2026-05-04T18:00:00', endAt: '2026-05-04T19:00:00' }),
      NOW,
    );
    // 4 May was a Monday; the next Monday after 21 May is 25 May.
    expect(out.startAt).toBe('2026-05-25T18:00');
    expect(new Date(out.startAt).getDay()).toBe(new Date('2026-05-04T18:00:00').getDay());
  });

  it('carries a recurrence rule across, and survives a missing template', async () => {
    const { prefillFromInstance, DEFAULT_GENERATED_OCCURRENCES } = await import(
      './sessions.config'
    );

    const recurring = prefillFromInstance(
      instance({
        template: {
          title: 'Yoga',
          type: 'GROUP',
          locationKind: 'IN_PERSON',
          durationMinutes: 45,
          capacity: null,
          priceAmountCents: 0,
          recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 3] },
        },
      }),
      NOW,
    );
    expect(recurring.isRecurring).toBe(true);
    expect(recurring.daysOfWeek).toEqual([1, 3]);
    expect(recurring.endAfterOccurrences).toBe(DEFAULT_GENERATED_OCCURRENCES);
    expect(recurring.priceAmount).toBeNull();

    // A list response can omit the template entirely.
    const bare = prefillFromInstance(instance({ template: undefined }), NOW);
    expect(bare.type).toBe('GROUP');
    expect(bare.durationMinutes).toBe(60);
    expect(bare.isRecurring).toBe(false);
  });

  // The instance's nested template is the API's short field list, with no
  // rule: a weekly series duplicated from it became a one-off.
  it('reads the repeat from the full template when one is passed', async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const full = {
      title: 'Strength club',
      type: 'GROUP',
      locationKind: 'IN_PERSON',
      durationMinutes: 60,
      capacity: 14,
      priceAmountCents: 0,
      timezone: 'Europe/Bucharest',
      recurrenceRule: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [2, 4], endAfterOccurrences: 8 },
    } as unknown as SessionTemplate;

    const oneOff = prefillFromInstance(instance(), NOW);
    expect(oneOff.isRecurring).toBe(false);

    const series = prefillFromInstance(instance(), NOW, full);
    expect(series.isRecurring).toBe(true);
    expect(series.daysOfWeek).toEqual([2, 4]);
    expect(series.endAfterOccurrences).toBe(8);
  });

  // A copy keeps its source's zone, and the start is that zone's clock.
  it("carries the source's timezone, with the start on its clock", async () => {
    const { prefillFromInstance } = await import('./sessions.config');
    const out = prefillFromInstance(
      instance({
        startAt: '2026-11-25T18:00:00.000Z',
        endAt: '2026-11-25T19:00:00.000Z',
        template: { title: 'Run', type: 'OPEN', timezone: 'Europe/Bucharest', recurrenceRule: null },
      }),
      new Date('2026-11-21T09:00:00Z').getTime(),
    );
    expect(out.timezone).toBe('Europe/Bucharest');
    expect(out.startAt).toBe('2026-11-25T20:00');
  });
});

describe('time zones', () => {
  // The bug: 18:00 picked for Europe/London on a phone in Bucharest was read
  // in the phone's zone and stored as 16:00 in London.
  it('reads a picked wall clock in the picked zone', async () => {
    const { zonedWallClockToIso } = await import('./sessions.config');
    expect(zonedWallClockToIso('2026-11-21T18:00', 'Europe/London')).toBe('2026-11-21T18:00:00.000Z');
    expect(zonedWallClockToIso('2026-11-21T18:00', 'Europe/Bucharest')).toBe(
      '2026-11-21T16:00:00.000Z',
    );
    // Summer time on both sides.
    expect(zonedWallClockToIso('2026-07-01T18:00', 'Europe/London')).toBe('2026-07-01T17:00:00.000Z');
    expect(zonedWallClockToIso('2026-07-01T18:00:00', 'America/New_York')).toBe(
      '2026-07-01T22:00:00.000Z',
    );
  });

  it('lands on the right side of a clock change', async () => {
    const { zonedWallClockToIso } = await import('./sessions.config');
    // Bucharest moves to summer time at 03:00 on 29 March 2026.
    expect(zonedWallClockToIso('2026-03-28T18:00', 'Europe/Bucharest')).toBe(
      '2026-03-28T16:00:00.000Z',
    );
    expect(zonedWallClockToIso('2026-03-29T18:00', 'Europe/Bucharest')).toBe(
      '2026-03-29T15:00:00.000Z',
    );
  });

  it('shows an instant on a zone clock, the reverse of the above', async () => {
    const { wallClockInZone, zonedWallClockToIso } = await import('./sessions.config');
    expect(wallClockInZone('2026-11-21T16:00:00.000Z', 'Europe/Bucharest')).toBe('2026-11-21T18:00');
    expect(wallClockInZone('2026-11-21T00:30:00.000Z', 'Europe/London')).toBe('2026-11-21T00:30');
    const iso = '2026-07-14T05:45:00.000Z';
    expect(zonedWallClockToIso(wallClockInZone(iso, 'Asia/Tokyo'), 'Asia/Tokyo')).toBe(iso);
  });
});

describe('form checks', () => {
  it('takes a seat limit of 1 to 1000 whole seats, or none', async () => {
    const { isValidCapacity } = await import('./sessions.config');
    expect(isValidCapacity(null)).toBe(true);
    expect(isValidCapacity(1)).toBe(true);
    expect(isValidCapacity(1000)).toBe(true);
    expect(isValidCapacity(0)).toBe(false);
    expect(isValidCapacity(1001)).toBe(false);
    expect(isValidCapacity(2.5)).toBe(false);
    expect(isValidCapacity(-3)).toBe(false);
  });

  it('adds https to a link pasted without it, and refuses what the API would', async () => {
    const { meetingLinkFor } = await import('./sessions.config');
    expect(meetingLinkFor('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    expect(meetingLinkFor(' https://zoom.us/j/123 ')).toBe('https://zoom.us/j/123');
    expect(meetingLinkFor('http://zoom.us/j/123')).toBeNull();
    expect(meetingLinkFor('zoom')).toBeNull();
    expect(meetingLinkFor('javascript:alert(1)')).toBeNull();
    expect(meetingLinkFor('')).toBeNull();
  });

  it('flags a series end before its first day, and nothing else', async () => {
    const { endsBeforeStart } = await import('./sessions.config');
    expect(endsBeforeStart('2026-11-20', '2026-11-21T18:00')).toBe(true);
    expect(endsBeforeStart('2026-11-21', '2026-11-21T18:00')).toBe(false);
    expect(endsBeforeStart(null, '2026-11-21T18:00')).toBe(false);
  });

  it('tells an hour already begun from one ahead', async () => {
    const { hourHasStarted } = await import('./sessions.config');
    const day = new Date(2026, 10, 21);
    const now = new Date(2026, 10, 21, 14, 20).getTime();
    expect(hourHasStarted(day, 14, now)).toBe(true);
    expect(hourHasStarted(day, 15, now)).toBe(false);
    expect(hourHasStarted(new Date(2026, 10, 22), 8, now)).toBe(false);
  });
});

describe('sessionPriceLabel', () => {
  // `toFixed(0)` turned 49.50 into 50.
  it('keeps the cents when there are any, as the trainee screens do', async () => {
    const { sessionPriceLabel } = await import('./sessions.config');
    expect(sessionPriceLabel(4950, 'ron')).toBe('49.50 RON');
    expect(sessionPriceLabel(5000, 'RON')).toBe('50 RON');
    expect(sessionPriceLabel(0, 'RON')).toBeNull();
  });
});

describe('sessionShareUrl', () => {
  // The profile link opened the website on a phone; this path is the app's.
  it('links the session on the web app, which the app claims', async () => {
    const { sessionShareUrl } = await import('./sessions.config');
    const { WEB_APP_URL } = await import('core');
    expect(sessionShareUrl('i-42')).toBe(`${WEB_APP_URL}/sessions/i-42`);
  });
});

describe('the agenda list', () => {
  const HOUR = 3_600_000;
  const at = (offsetMs: number, id: string) =>
    ({
      id,
      startAt: new Date(Date.now() + offsetMs).toISOString(),
      endAt: new Date(Date.now() + offsetMs + HOUR).toISOString(),
      conflictingInstanceIds: null,
      template: { type: 'PRIVATE' },
    }) as unknown as SessionInstance;

  it('mutes a row once its session has ended, and only then', async () => {
    const { rowTone } = await import('./sessions.config');
    expect(rowTone(at(-3 * HOUR, 'done'))).toBe('muted');
    expect(rowTone(at(-HOUR / 2, 'live'))).toBe('navy');
    expect(rowTone(at(2 * HOUR, 'next'))).toBe('navy');
  });

  it('runs from today, unless a date filter asks for earlier', async () => {
    const { NO_FILTERS, agendaRows } = await import('./sessions.config');
    const today = new Date();
    const rows = [at(-3 * 24 * HOUR, 'old'), at(2 * HOUR, 'soon')];
    expect(agendaRows(rows, NO_FILTERS, today).map((row) => row.id)).toEqual(['soon']);
    expect(
      agendaRows(rows, { ...NO_FILTERS, dateFrom: '2020-01-01' }, today).map((row) => row.id),
    ).toEqual(['old', 'soon']);
  });
});

describe('findOverlap', () => {
  const loaded = [
    { id: 'a', startAt: '2026-05-21T10:00:00', endAt: '2026-05-21T11:00:00' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any[];

  it('finds a genuine overlap', async () => {
    const { findOverlap } = await import('./sessions.config');
    expect(findOverlap(loaded, new Date('2026-05-21T10:30:00'), 60)?.id).toBe('a');
  });

  // Back-to-back is the common case and must not warn, or the warning becomes
  // noise a coach learns to ignore.
  it('treats touching edges as clear', async () => {
    const { findOverlap } = await import('./sessions.config');
    expect(findOverlap(loaded, new Date('2026-05-21T11:00:00'), 60)).toBeNull();
    expect(findOverlap(loaded, new Date('2026-05-21T09:00:00'), 60)).toBeNull();
  });

  it('returns null for an unusable start', async () => {
    const { findOverlap } = await import('./sessions.config');
    expect(findOverlap(loaded, new Date('nonsense'), 60)).toBeNull();
  });
});

describe('activeFilterCount', () => {
  it('counts a date range once, not once per bound', async () => {
    const { NO_FILTERS, activeFilterCount } = await import('./sessions.config');
    expect(activeFilterCount({ ...NO_FILTERS, dateFrom: '2026-05-01' })).toBe(1);
    expect(
      activeFilterCount({ ...NO_FILTERS, dateFrom: '2026-05-01', dateTo: '2026-05-31' }),
    ).toBe(1);
  });

  it('counts each other dimension separately', async () => {
    const { NO_FILTERS, activeFilterCount } = await import('./sessions.config');
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...NO_FILTERS,
        type: 'GROUP',
        locationKind: 'ONLINE',
        status: 'conflict',
        groupId: 'g-1',
        dateTo: '2026-05-31',
      }),
    ).toBe(5);
  });
});

describe('sheetChipCount', () => {
  it('leaves a place alone to the location chips', async () => {
    const { NO_FILTERS, sheetChipCount } = await import('./sessions.config');
    expect(sheetChipCount(NO_FILTERS)).toBe(0);
    expect(sheetChipCount({ ...NO_FILTERS, locationKind: 'ONLINE' })).toBe(0);
  });

  it('counts everything once the sheet holds more than a place', async () => {
    const { NO_FILTERS, sheetChipCount } = await import('./sessions.config');
    expect(sheetChipCount({ ...NO_FILTERS, locationKind: 'ONLINE', type: 'GROUP' })).toBe(2);
    expect(sheetChipCount({ ...NO_FILTERS, dateFrom: '2026-05-01' })).toBe(1);
  });
});

describe('window fitting', () => {
  const day = (iso: string) => new Date(`${iso}T12:00:00`);

  it('rounds out to whole months so cache keys collapse', async () => {
    const { quantiseToMonths } = await import('./sessions.config');
    const out = quantiseToMonths({ start: day('2026-05-14'), end: day('2026-05-22') });
    expect(out.start.getDate()).toBe(1);
    expect(out.start.getMonth()).toBe(4);
    // May has 31 days; the end must land on the last of the month, not the 1st
    // of the next, or the window silently gains a day.
    expect(out.end.getDate()).toBe(31);
    expect(out.end.getMonth()).toBe(4);
  });

  // Midnight-to-midnight, because the end bound is 23:59:59.999 and the BE
  // compares the raw difference against 180.
  it('measures whole days, ignoring the end-of-day time', async () => {
    const { windowDays } = await import('./sessions.config');
    expect(
      windowDays({ start: day('2026-05-01'), end: new Date('2026-05-31T23:59:59.999') }),
    ).toBe(30);
  });

  it('keeps the anchor and drops extras that will not fit', async () => {
    const { fitWindow, windowDays, MAX_RANGE_DAYS } = await import('./sessions.config');
    const anchor = { start: day('2026-05-01'), end: day('2026-05-31') };
    const far = { start: day('2027-01-01'), end: day('2027-01-31') };

    const out = fitWindow(anchor, [far]);
    expect(windowDays(out)).toBeLessThanOrEqual(MAX_RANGE_DAYS);
    // The anchor is what the user is looking at, so it survives intact.
    expect(out.start.getMonth()).toBe(4);
    expect(out.end.getMonth()).toBe(4);
  });

  it('absorbs an extra that does fit', async () => {
    const { fitWindow } = await import('./sessions.config');
    const out = fitWindow(
      { start: day('2026-05-01'), end: day('2026-05-31') },
      [{ start: day('2026-06-10'), end: day('2026-06-20') }],
    );
    expect(out.start.getMonth()).toBe(4);
    expect(out.end.getMonth()).toBe(5);
  });

  // The regression this whole helper exists for: paging the month card forward
  // used to widen one window past the BE's cap, and every request after that
  // 400'd into the error screen.
  it('never exceeds the cap however far the cursor is paged', async () => {
    const { fitWindow, windowDays, MAX_RANGE_DAYS } = await import('./sessions.config');
    const base = { start: day('2026-05-01'), end: day('2026-05-31') };

    let cursor = { start: day('2026-05-01'), end: day('2026-05-31') };
    for (let step = 0; step < 18; step++) {
      cursor = {
        start: new Date(cursor.start.getFullYear(), cursor.start.getMonth() + 1, 1, 12),
        end: new Date(cursor.start.getFullYear(), cursor.start.getMonth() + 2, 0, 12),
      };
      const out = fitWindow(cursor, [base]);
      expect(windowDays(out)).toBeLessThanOrEqual(MAX_RANGE_DAYS);
    }
  });

  // Quantising can overshoot on its own: a sub-180-day range touching seven
  // months rounds out past the cap.
  it('gives up the month rounding before it gives up the request', async () => {
    const { fitWindow, windowDays, MAX_RANGE_DAYS } = await import('./sessions.config');
    const out = fitWindow({ start: day('2026-01-20'), end: day('2026-07-10') }, []);
    expect(windowDays(out)).toBeLessThanOrEqual(MAX_RANGE_DAYS);
    // Still covers what was asked for, just without the rounding.
    expect(out.start.getTime()).toBeLessThanOrEqual(day('2026-01-20').getTime());
  });
});

describe('onTheRoster', () => {
  it('lists people with a place and requests waiting, never cancelled or declined bookings', () => {
    expect(onTheRoster({ status: 'CONFIRMED' })).toBe(true);
    expect(onTheRoster({ status: 'PENDING_APPROVAL' })).toBe(true);
    expect(onTheRoster({ status: 'CANCELLED' })).toBe(false);
    expect(onTheRoster({ status: 'DECLINED' })).toBe(false);
    expect(onTheRoster({ status: 'WAITLISTED' })).toBe(false);
  });
});

describe('where a day opens on the hour rail', () => {
  /** A session starting at `hour:minute` on 21 Nov 2026, on the phone's clock. */
  function at(hour: number, minute = 0, day = 21): SessionInstance {
    const start = new Date(2026, 10, day, hour, minute);
    return {
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3_600_000).toISOString(),
    } as SessionInstance;
  }
  const DAY = new Date(2026, 10, 21);

  it("opens on the day's first session, whatever order they come in", async () => {
    const { dayOpenHour } = await import('./sessions.config');
    expect(dayOpenHour([at(18), at(9, 30), at(12)], DAY, Date.now())).toBe(9.5);
  });

  // Only that day's sessions place it; a late one the day before does not.
  it("ignores another day's sessions", async () => {
    const { dayOpenHour } = await import('./sessions.config');
    expect(dayOpenHour([at(6, 0, 20), at(17)], DAY, Date.now())).toBe(17);
  });

  it('opens today on the hour it is now, and another quiet day on 08:00', async () => {
    const { DAY_OPEN_HOUR, dayOpenHour } = await import('./sessions.config');
    const now = new Date(2026, 10, 21, 14, 40).getTime();
    expect(dayOpenHour([], DAY, now)).toBe(14);
    expect(dayOpenHour([], new Date(2026, 10, 24), now)).toBe(DAY_OPEN_HOUR);
    expect(DAY_OPEN_HOUR).toBe(8);
  });

  it('keeps half an hour of context above it, and stays at the top near the start', async () => {
    const { railScrollOffset } = await import('./sessions.config');
    // 17:30 on a rail drawn from 06:00 at 44px an hour: 11 hours down.
    expect(railScrollOffset(17.5, 6, 44)).toBe(11 * 44);
    expect(railScrollOffset(7, 7, 44)).toBe(0);
    expect(railScrollOffset(6.25, 6, 44)).toBe(0);
  });
});

describe('canReschedule', () => {
  const HOUR = 3_600_000;
  const NOW = new Date('2026-11-21T09:00:00Z').getTime();

  function instance(status: string, startOffsetMs: number): SessionInstance {
    return {
      status,
      startAt: new Date(NOW + startOffsetMs).toISOString(),
      endAt: new Date(NOW + startOffsetMs + HOUR).toISOString(),
    } as SessionInstance;
  }

  it('moves a scheduled date still ahead', async () => {
    const { canReschedule } = await import('./sessions.config');
    expect(canReschedule(instance('SCHEDULED', 2 * HOUR), NOW)).toBe(true);
  });

  // The status cron runs late, so a SCHEDULED row can already be under way.
  it('leaves one that has started, finished or been cancelled', async () => {
    const { canReschedule } = await import('./sessions.config');
    expect(canReschedule(instance('SCHEDULED', -HOUR / 2), NOW)).toBe(false);
    expect(canReschedule(instance('COMPLETED', -3 * HOUR), NOW)).toBe(false);
    expect(canReschedule(instance('CANCELLED', 2 * HOUR), NOW)).toBe(false);
  });
});

describe('access and price', () => {
  it('asks Paid for a price above zero, and nobody else', async () => {
    const { priceMissing } = await import('./sessions.config');
    expect(priceMissing('OPEN', null)).toBe(true);
    expect(priceMissing('OPEN', 0)).toBe(true);
    expect(priceMissing('OPEN', 49.5)).toBe(false);
    expect(priceMissing('FREE', null)).toBe(false);
    expect(priceMissing('CLIENTS_ONLY', null)).toBe(false);
    expect(priceMissing('GROUP_ONLY', null)).toBe(false);
  });

  it('saves no price for Free, and an empty field as none', async () => {
    const { accessTakesPrice, priceCentsFor } = await import('./sessions.config');
    expect(accessTakesPrice('FREE')).toBe(false);
    expect(accessTakesPrice('OPEN')).toBe(true);
    expect(priceCentsFor('FREE', 50)).toBeNull();
    expect(priceCentsFor('CLIENTS_ONLY', null)).toBeNull();
    expect(priceCentsFor('OPEN', 49.5)).toBe(4950);
  });

  // A "Paid" badge stood beside a free price on sessions saved without one.
  it('names an OPEN session without a price Free', async () => {
    const { accessLevelFor } = await import('./sessions.config');
    expect(accessLevelFor('OPEN', 0).label).toBe('Free');
    expect(accessLevelFor('OPEN', null).label).toBe('Free');
    expect(accessLevelFor('OPEN', 4950).label).toBe('Paid');
    expect(accessLevelFor('CLIENTS_ONLY', 0).label).toBe('Clients only');
    expect(accessLevelFor('FREE', 0).label).toBe('Free');
  });
});
