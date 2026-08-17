/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  LOCATION_KIND_OPTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
} from './sessions.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
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
 * Three sources, because a name reaches `ion-icon` three ways here: a static
 * attribute, a kebab literal inside a conditional binding, and the `icon` field
 * on the option constants the create sheet iterates — that last one lives in
 * TypeScript, so no amount of template scanning would find it.
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

  for (const option of [...SESSION_TYPE_OPTIONS, ...LOCATION_KIND_OPTIONS]) {
    names.add(option.icon);
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

  // The regression this whole helper exists for: paging the month sheet forward
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
