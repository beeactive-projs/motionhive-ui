/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type { InstructorSearchResult, PublicSessionInstance } from 'core';
import { SessionLocationKind, SessionType } from 'core';

import { bookingPriceLabel } from '../user/sessions/my-sessions.config';
import {
  DISCOVER_ICONS,
  DiscoverDatePresets,
  DiscoverTones,
  NO_SHEET_FILTERS,
  QuickFilterIds,
  coachMeta,
  coachName,
  compileDatePreset,
  discoverMeta,
  discoverTone,
  fullChip,
  isSessionFull,
  matchesSpecialization,
  quickFilterSelected,
  sessionPriceParts,
  sheetFilterCount,
  sortCoaches,
  specializationOptions,
  spotsLabel,
} from './discover.config';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Component sources too — some icons are picked in TypeScript. */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `person-outline` → `personOutline`, the key `addIcons()` registers under. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Same guard as the sessions features' config specs. */
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

  return [...names];
}

const registered = new Set(Object.keys(DISCOVER_ICONS));

describe('DISCOVER_ICONS', () => {
  it('registers every icon the discover screens render', () => {
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

function instance(
  overrides: Partial<{
    capacityOverride: number | null;
    confirmedCount: number;
    capacity: number | null;
    waitlistEnabled: boolean;
    type: SessionType;
    locationKind: SessionLocationKind;
    venueName: string | null;
    firstName: string;
    lastName: string;
  }> = {},
): PublicSessionInstance {
  return {
    id: 'inst-1',
    templateId: 'tmpl-1',
    instructorId: 'usr-1',
    startAt: '2026-08-26T10:00:00Z',
    endAt: '2026-08-26T11:00:00Z',
    titleOverride: null,
    capacityOverride: overrides.capacityOverride ?? null,
    confirmedCount: overrides.confirmedCount ?? 0,
    template: {
      id: 'tmpl-1',
      title: 'Evening yoga flow',
      type: overrides.type ?? SessionType.Group,
      locationKind: overrides.locationKind ?? SessionLocationKind.Online,
      capacity: overrides.capacity ?? null,
      waitlistEnabled: overrides.waitlistEnabled ?? true,
      venue:
        overrides.venueName !== undefined && overrides.venueName !== null
          ? { id: 'v-1', name: overrides.venueName, city: null, kind: 'GYM' }
          : null,
      instructor: {
        id: 'usr-1',
        firstName: overrides.firstName ?? 'Ana',
        lastName: overrides.lastName ?? 'Popescu',
        avatarUrl: null,
        handle: 'ana',
      },
    },
  } as unknown as PublicSessionInstance;
}

function coach(
  overrides: Partial<InstructorSearchResult> = {},
): InstructorSearchResult {
  return {
    id: 'prof-1',
    userId: 'usr-1',
    handle: 'ana',
    firstName: 'Ana',
    lastName: 'Popescu',
    avatarId: null,
    avatarUrl: null,
    displayName: null,
    bio: null,
    specializations: ['Yoga'],
    yearsOfExperience: 8,
    isAcceptingClients: true,
    city: 'Bucharest',
    country: 'RO',
    socialLinks: null,
    ...overrides,
  };
}

// ─── Spine tone ────────────────────────────────────────────────────────────

describe('discoverTone', () => {
  // Deliberate divergence from core SESSION_TYPES (Group=honey, Private=navy,
  // Open=teal): the Discover design keys honey=1-on-1, violet=group,
  // teal=open. The coach agenda keeps the core map — both are correct.
  it('maps the design vocabulary: honey 1-on-1, violet group, teal open', () => {
    expect(discoverTone(SessionType.Private)).toBe(DiscoverTones.Private);
    expect(DiscoverTones.Private).toBe('honey');
    expect(discoverTone(SessionType.Group)).toBe('violet');
    expect(discoverTone(SessionType.Open)).toBe('teal');
    expect(discoverTone(undefined)).toBeNull();
  });
});

// ─── Price ─────────────────────────────────────────────────────────────────

describe('sessionPriceParts', () => {
  it('mirrors bookingPriceLabel rendering rules', () => {
    // Free.
    expect(sessionPriceParts(0, 'RON')).toEqual({ free: true });
    expect(bookingPriceLabel(0, 'RON')).toBe('Free');

    // Whole amount — no decimals.
    expect(sessionPriceParts(5000, 'ron')).toEqual({
      free: false,
      amount: '50',
      currency: 'RON',
    });
    expect(bookingPriceLabel(5000, 'ron')).toBe('50 RON');

    // Fractional amount — two decimals.
    expect(sessionPriceParts(4950, 'RON')).toEqual({
      free: false,
      amount: '49.50',
      currency: 'RON',
    });
    expect(bookingPriceLabel(4950, 'RON')).toBe('49.50 RON');
  });
});

// ─── Spots / capacity ──────────────────────────────────────────────────────

describe('spots and full chip', () => {
  it('capacityOverride wins over template capacity', () => {
    const i = instance({ capacity: 12, capacityOverride: 5, confirmedCount: 5 });
    expect(isSessionFull(i)).toBe(true);
  });

  it('null capacity means unlimited — no spots line, never full', () => {
    const i = instance({ capacity: null, confirmedCount: 100 });
    expect(spotsLabel(i)).toBeNull();
    expect(isSessionFull(i)).toBe(false);
    expect(fullChip(i)).toBeNull();
  });

  it('renders "n of m spots" while there is room', () => {
    expect(spotsLabel(instance({ capacity: 12, confirmedCount: 5 }))).toBe(
      '5 of 12 spots',
    );
  });

  it('never renders spots for a 1-on-1', () => {
    expect(
      spotsLabel(
        instance({ type: SessionType.Private, capacity: 1, confirmedCount: 0 }),
      ),
    ).toBeNull();
  });

  it('full swaps the spots line for the chip — sky with waitlist, muted without', () => {
    const full = instance({ capacity: 10, confirmedCount: 10, waitlistEnabled: true });
    expect(spotsLabel(full)).toBeNull();
    expect(fullChip(full)).toEqual({ label: 'Full · waitlist', tone: 'info' });

    const noWaitlist = instance({
      capacity: 10,
      confirmedCount: 10,
      waitlistEnabled: false,
    });
    expect(fullChip(noWaitlist)).toEqual({ label: 'Full', tone: 'medium' });
  });
});

// ─── Meta line ─────────────────────────────────────────────────────────────

describe('discoverMeta', () => {
  it('renders full name · place, Online for online sessions', () => {
    expect(discoverMeta(instance())).toBe('Ana Popescu · Online');
    expect(
      discoverMeta(
        instance({
          locationKind: SessionLocationKind.InPerson,
          venueName: 'Studio One',
        }),
      ),
    ).toBe('Ana Popescu · Studio One');
  });
});

// ─── Date presets ──────────────────────────────────────────────────────────

describe('compileDatePreset', () => {
  // Wednesday, local time.
  const wednesday = new Date(2026, 7, 26, 10, 0, 0);

  it('Any clears both bounds explicitly', () => {
    expect(compileDatePreset(DiscoverDatePresets.Any, wednesday)).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it('This week runs now → Sunday end of day', () => {
    const window = compileDatePreset(DiscoverDatePresets.ThisWeek, wednesday);
    expect(window.dateFrom).toBe(wednesday.toISOString());
    const to = new Date(window.dateTo!);
    expect(to.getDay()).toBe(0); // Sunday
    expect(to.getDate()).toBe(30);
    expect(to.getHours()).toBe(23);
  });

  it('This weekend runs Saturday start → Sunday end from a weekday', () => {
    const window = compileDatePreset(DiscoverDatePresets.Weekend, wednesday);
    const from = new Date(window.dateFrom!);
    expect(from.getDay()).toBe(6); // Saturday
    expect(from.getHours()).toBe(0);
    expect(new Date(window.dateTo!).getDay()).toBe(0);
  });

  it('This weekend starts NOW when it is already the weekend', () => {
    const saturday = new Date(2026, 7, 29, 9, 0, 0);
    const window = compileDatePreset(DiscoverDatePresets.Weekend, saturday);
    expect(window.dateFrom).toBe(saturday.toISOString());

    const sunday = new Date(2026, 7, 30, 9, 0, 0);
    const sundayWindow = compileDatePreset(DiscoverDatePresets.Weekend, sunday);
    expect(sundayWindow.dateFrom).toBe(sunday.toISOString());
    expect(new Date(sundayWindow.dateTo!).getTime()).toBeGreaterThan(
      sunday.getTime(),
    );
  });

  it('Next two weeks runs now → +14 days end of day', () => {
    const window = compileDatePreset(DiscoverDatePresets.TwoWeeks, wednesday);
    expect(window.dateFrom).toBe(wednesday.toISOString());
    const to = new Date(window.dateTo!);
    expect(to.getMonth()).toBe(8); // September
    expect(to.getDate()).toBe(9);
    expect(to.getHours()).toBe(23);
  });
});

// ─── Sheet filter count ────────────────────────────────────────────────────

describe('sheetFilterCount', () => {
  it('counts each set dimension once', () => {
    expect(sheetFilterCount(NO_SHEET_FILTERS)).toBe(0);
    expect(
      sheetFilterCount({
        type: SessionType.Open,
        locationKind: SessionLocationKind.Online,
        datePreset: DiscoverDatePresets.ThisWeek,
      }),
    ).toBe(3);
    expect(
      sheetFilterCount({
        type: null,
        locationKind: null,
        datePreset: DiscoverDatePresets.Weekend,
      }),
    ).toBe(1);
  });
});

// ─── Quick filter selection ────────────────────────────────────────────────

describe('quickFilterSelected', () => {
  it('derives selection from store filters', () => {
    expect(quickFilterSelected({}, QuickFilterIds.All)).toBe(true);
    expect(
      quickFilterSelected(
        { locationKind: SessionLocationKind.Online },
        QuickFilterIds.Online,
      ),
    ).toBe(true);
    expect(
      quickFilterSelected({ type: SessionType.Private }, QuickFilterIds.OneOnOne),
    ).toBe(true);
  });

  it('a sheet-applied combination lights no chip, All included', () => {
    const combined = {
      type: SessionType.Group,
      locationKind: SessionLocationKind.Online,
    };
    for (const id of Object.values(QuickFilterIds)) {
      expect(quickFilterSelected(combined, id), id).toBe(false);
    }
    // Type Open exists only in the sheet — nothing lights either.
    for (const id of Object.values(QuickFilterIds)) {
      expect(quickFilterSelected({ type: SessionType.Open }, id), id).toBe(false);
    }
  });
});

// ─── Coaches ───────────────────────────────────────────────────────────────

describe('coach helpers', () => {
  it('coachName prefers displayName, falls back to first + last', () => {
    expect(coachName(coach({ displayName: 'Coach Ana' }))).toBe('Coach Ana');
    expect(coachName(coach())).toBe('Ana Popescu');
  });

  it('coachMeta renders location · experience, "New coach" without years', () => {
    expect(coachMeta(coach())).toBe('Bucharest, RO · 8 yrs experience');
    expect(coachMeta(coach({ yearsOfExperience: null }))).toBe(
      'Bucharest, RO · New coach',
    );
    expect(coachMeta(coach({ city: null, country: null }))).toBe(
      '8 yrs experience',
    );
  });

  it('sortCoaches puts accepting coaches first, then names', () => {
    const closed = coach({ id: 'p2', firstName: 'Ana', isAcceptingClients: false });
    const acceptingZ = coach({ id: 'p3', firstName: 'Zoe', lastName: 'Marin' });
    const acceptingA = coach({ id: 'p1', firstName: 'Ana' });
    expect(
      sortCoaches([closed, acceptingZ, acceptingA]).map((c) => c.id),
    ).toEqual(['p1', 'p3', 'p2']);
  });

  it('specializationOptions dedupes case-insensitively and sorts', () => {
    const list = [
      coach({ specializations: ['Yoga', 'strength'] }),
      coach({ id: 'p2', specializations: ['Strength', 'Boxing', ' '] }),
      coach({ id: 'p3', specializations: null }),
    ];
    expect(specializationOptions(list)).toEqual(['Boxing', 'strength', 'Yoga']);
  });

  it('matchesSpecialization is an exact case-insensitive match', () => {
    expect(matchesSpecialization(coach(), 'yoga')).toBe(true);
    expect(matchesSpecialization(coach(), 'yog')).toBe(false);
    expect(matchesSpecialization(coach(), null)).toBe(true);
  });
});
