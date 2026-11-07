/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type {
  Category,
  DiscoverGroup,
  InstructorSearchResult,
  PublicSessionInstance,
} from 'core';
import { GroupMemberPostPolicies, JoinPolicies, SessionLocationKind, SessionType } from 'core';

import { bookingPriceLabel } from '../user/sessions/my-sessions.config';
import {
  CATEGORY_WORDS,
  DISCOVER_ICONS,
  DiscoverDatePresets,
  DiscoverRecent,
  DiscoverTones,
  DiscoverTopicIds,
  EVERYWHERE,
  GroupVerbs,
  TOPIC_CHIP_LIMIT,
  NO_SHEET_FILTERS,
  QuickFilterIds,
  RECENT_LIMIT,
  RecentKinds,
  accentVariant,
  bioQuote,
  browseTopics,
  categoryTopic,
  cityKey,
  coachBadge,
  coachFacts,
  coachMatchesTopic,
  coachName,
  coachNearLine,
  coachOfTheWeek,
  coachSubline,
  compileDatePreset,
  discoverCities,
  discoverGroupMeta,
  discoverGroupMetaParts,
  discoverLinks,
  discoverMeta,
  discoverTone,
  discoverTopicChips,
  forYouTopic,
  fullChip,
  groupMatchesTopic,
  groupVerb,
  highlightParts,
  inCity,
  isSessionFull,
  isoWeek,
  parseRecents,
  pushRecent,
  quickFilterSelected,
  resolveCity,
  onlineTopic,
  sessionInCity,
  sessionMatchesTopic,
  sessionPriceParts,
  sheetBeyondQuickChips,
  sheetFilterCount,
  sortCoaches,
  spotsLabel,
  textMatchesWords,
  withoutReader,
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

function category(
  slug: string,
  kind: Category['kind'],
  displayOrder: number,
  icon = 'barbell-outline',
): Category {
  return { id: `id-${slug}`, slug, kind, name: slug, icon, displayOrder, coachesOnly: false };
}

const running = category('running', 'ACTIVITY', 2, 'footsteps-outline');
const yoga = category('yoga', 'ACTIVITY', 3, 'flower-outline');
const loseFat = category('lose-fat', 'GOAL', 2, 'flame-outline');
/** What `CategoryStore.activities` hands the topic helpers: the goal is not among them. */
const ACTIVITIES: Category[] = [running, yoga];

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
    isOnline: false,
    city: 'Bucharest',
    countryCode: 'RO',
    socialLinks: null,
    ...overrides,
  };
}

function group(overrides: Partial<DiscoverGroup> = {}): DiscoverGroup {
  return {
    id: 'grp-1',
    instructorId: 'prof-1',
    name: 'Forță pentru începători',
    slug: 'forta',
    description: null,
    logoUrl: null,
    timezone: 'Europe/Bucharest',
    isActive: true,
    isPublic: true,
    joinPolicy: JoinPolicies.Open,
    memberPostPolicy: GroupMemberPostPolicies.Open,
    tags: null,
    contactEmail: null,
    contactPhone: null,
    address: null,
    city: 'Cluj-Napoca',
    country: 'RO',
    memberCount: 12,
    joinToken: null,
    joinTokenExpiresAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    myJoinRequestStatus: null,
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

describe('sheetBeyondQuickChips', () => {
  const sheet = (patch: Partial<typeof NO_SHEET_FILTERS>) => ({ ...NO_SHEET_FILTERS, ...patch });

  it('is false while a quick chip says it all', () => {
    expect(sheetBeyondQuickChips(NO_SHEET_FILTERS)).toBe(false);
    expect(sheetBeyondQuickChips(sheet({ locationKind: SessionLocationKind.Online }))).toBe(false);
    expect(sheetBeyondQuickChips(sheet({ type: SessionType.Group }))).toBe(false);
  });

  it('is true for a date, a combination or a sheet-only type', () => {
    expect(sheetBeyondQuickChips(sheet({ datePreset: DiscoverDatePresets.Weekend }))).toBe(true);
    expect(
      sheetBeyondQuickChips(
        sheet({ type: SessionType.Group, locationKind: SessionLocationKind.Online }),
      ),
    ).toBe(true);
    expect(sheetBeyondQuickChips(sheet({ type: SessionType.Open }))).toBe(true);
  });
});

// ─── Coaches ───────────────────────────────────────────────────────────────

describe('coach helpers', () => {
  it('coachName prefers displayName, falls back to first + last', () => {
    expect(coachName(coach({ displayName: 'Coach Ana' }))).toBe('Coach Ana');
    expect(coachName(coach())).toBe('Ana Popescu');
  });

  it('coachSubline says what they coach, then where', () => {
    expect(coachSubline(coach({ specializations: ['Yoga', ' Pilates '] }))).toBe(
      'Yoga · Pilates · Bucharest',
    );
    expect(coachSubline(coach({ city: null }))).toBe('Yoga');
    expect(coachSubline(coach({ specializations: null }))).toBe('Bucharest');
  });

  it('coachSubline falls back to experience, "New coach" without years', () => {
    const bare = { city: null, specializations: [] };
    expect(coachSubline(coach(bare))).toBe('8 yrs experience');
    expect(coachSubline(coach({ ...bare, yearsOfExperience: 1 }))).toBe('1 yr experience');
    expect(coachSubline(coach({ ...bare, yearsOfExperience: 0 }))).toBe('New coach');
    expect(coachSubline(coach({ ...bare, yearsOfExperience: null }))).toBe('New coach');
  });

  it('sortCoaches puts accepting coaches first, then names', () => {
    const closed = coach({ id: 'p2', firstName: 'Ana', isAcceptingClients: false });
    const acceptingZ = coach({ id: 'p3', firstName: 'Zoe', lastName: 'Marin' });
    const acceptingA = coach({ id: 'p1', firstName: 'Ana' });
    expect(
      sortCoaches([closed, acceptingZ, acceptingA]).map((c) => c.id),
    ).toEqual(['p1', 'p3', 'p2']);
  });
});

// ─── Groups ────────────────────────────────────────────────────────────────

describe('discoverGroupMeta', () => {
  it('reads size, then where', () => {
    expect(discoverGroupMeta(group())).toBe('12 members · Cluj-Napoca');
    expect(discoverGroupMeta(group({ memberCount: 1, city: null }))).toBe('1 member');
  });

  it('comes in parts, so a card can keep each one whole', () => {
    expect(discoverGroupMetaParts(group({ city: ' Cluj-Napoca ' }))).toEqual(['12 members', 'Cluj-Napoca']);
  });

  it('leads with a pending request, so the row does not read as untouched', () => {
    expect(discoverGroupMeta(group({ myJoinRequestStatus: 'PENDING' }))).toBe(
      'Request pending · 12 members · Cluj-Napoca',
    );
  });
});

describe('coach lines and badge', () => {
  it('coachNearLine shows two specialties, then the years, or the city across cities', () => {
    const ana = coach({ specializations: ['Forță', 'Alergare', 'Mobilitate'], city: 'Cluj-Napoca', yearsOfExperience: 6 });
    expect(coachNearLine(ana, false)).toBe('Forță · Alergare · 6 yrs');
    expect(coachNearLine(ana, true)).toBe('Forță · Alergare · Cluj-Napoca');
    expect(coachNearLine(coach({ specializations: [], yearsOfExperience: null }), false)).toBe('Bucharest');
  });

  it('coachFacts is up to three specialties and the years', () => {
    expect(coachFacts(coach({ specializations: ['A', 'B', 'C', 'D'], yearsOfExperience: 1 }))).toBe('A · B · C · 1 yr');
    expect(coachFacts(coach({ specializations: null, yearsOfExperience: 0 }))).toBe('');
  });

  it('coachBadge says Online for an online coach, else Taking clients, else nothing', () => {
    expect(coachBadge(coach({ isOnline: true }))).toEqual({ label: 'Online', tone: 'teal' });
    expect(coachBadge(coach())).toEqual({ label: 'Taking clients', tone: 'success' });
    expect(coachBadge(coach({ isAcceptingClients: false }))).toBeNull();
  });

  // The venue decides, so a coach who only writes "online" in their
  // specialties is not badged as one.
  it('coachBadge never reads Online off a word in the specialties', () => {
    expect(coachBadge(coach({ specializations: ['Online coaching'] }))?.label).toBe('Taking clients');
  });

  it("coachBadge puts the reader's own coach first", () => {
    expect(coachBadge(coach({ isOnline: true }), { mine: true })).toEqual({
      label: 'Your coach',
      tone: 'violet',
    });
  });

  // Amber, as the coach's Clients list shows the same pending request.
  it('coachBadge says Request sent over Online while the request waits', () => {
    expect(coachBadge(coach({ isOnline: true, requestSent: true }))).toEqual({
      label: 'Request sent',
      tone: 'warning',
    });
    expect(coachBadge(coach({ requestSent: true }), { mine: true })?.label).toBe('Your coach');
  });

  it('withoutReader leaves the reader out, and everyone in without one', () => {
    const list = [coach(), coach({ id: 'p2', userId: 'usr-2' })];
    expect(withoutReader(list, 'usr-1').map((c) => c.id)).toEqual(['p2']);
    expect(withoutReader(list, null)).toHaveLength(2);
  });
});

describe('bioQuote', () => {
  it('takes the first sentence, tidied', () => {
    expect(bioQuote('  I help beginners lift.   Ten years in.')).toBe('I help beginners lift.');
    expect(bioQuote('No full stop here')).toBe('No full stop here');
    expect(bioQuote('Ce faci? Hai la sală.')).toBe('Ce faci?');
  });

  it('is null without a bio', () => {
    expect(bioQuote(null)).toBeNull();
    expect(bioQuote('   ')).toBeNull();
  });

  it('cuts a long sentence at a word with an ellipsis', () => {
    const long = `${'word '.repeat(40)}end.`;
    const quote = bioQuote(long, 40)!;
    expect(quote.endsWith('word…')).toBe(true);
    expect(quote.length).toBeLessThanOrEqual(41);
  });
});

describe('coach of the week', () => {
  it('isoWeek follows ISO 8601', () => {
    expect(isoWeek(new Date(2026, 9, 31))).toBe(44); // Saturday
    expect(isoWeek(new Date(2026, 10, 2))).toBe(45); // the Monday after
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53); // 2026 has 53 weeks
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1); // a Monday in 2025's week 1
  });

  const pool = [
    coach({ id: 'c3', userId: 'u3', city: 'Cluj-Napoca' }),
    coach({ id: 'c1', userId: 'u1', city: 'Cluj-Napoca' }),
    coach({ id: 'c2', userId: 'u2', city: 'Timișoara' }),
    coach({ id: 'c4', userId: 'u4', isAcceptingClients: false }),
  ];
  const saturday = new Date(2026, 9, 31);
  const monday = new Date(2026, 10, 2);

  it('picks by the week among coaches taking clients, the same for everyone', () => {
    // Ordered by id: c1, c2, c3. Week 44 → 44 % 3 = 2 → c3.
    expect(coachOfTheWeek(pool, { cityKey: null, readerId: 'u9', topic: null, now: saturday })?.id).toBe('c3');
    expect(coachOfTheWeek(pool, { cityKey: null, readerId: 'u8', topic: null, now: saturday })?.id).toBe('c3');
    // Changes on Monday: week 45 → 0 → c1.
    expect(coachOfTheWeek(pool, { cityKey: null, readerId: 'u9', topic: null, now: monday })?.id).toBe('c1');
  });

  it('never picks the reader: their week goes to the next coach', () => {
    expect(coachOfTheWeek(pool, { cityKey: null, readerId: 'u3', topic: null, now: saturday })?.id).toBe('c1');
    expect(coachOfTheWeek([pool[0]], { cityKey: null, readerId: 'u3', topic: null, now: saturday })).toBeNull();
  });

  it('keeps to the city, and falls back to every city when it has nobody', () => {
    const cluj = cityKey('Cluj-Napoca');
    // Cluj: c1, c3. Week 44 → 0 → c1.
    expect(coachOfTheWeek(pool, { cityKey: cluj, readerId: null, topic: null, now: saturday })?.id).toBe('c1');
    const bucharest = cityKey('București');
    expect(coachOfTheWeek(pool, { cityKey: bucharest, readerId: null, topic: null, now: saturday })?.id).toBe('c3');
    // Only the reader in the city counts as nobody.
    const timisoara = cityKey('Timisoara');
    expect(coachOfTheWeek(pool, { cityKey: timisoara, readerId: 'u2', topic: null, now: saturday })?.id).toBe('c3');
  });

  it('narrows to the topic, and is null when no coach fits', () => {
    const runner = coach({ id: 'c5', userId: 'u5', categoryIds: [running.id] });
    expect(coachOfTheWeek([...pool, runner], { cityKey: null, readerId: null, topic: categoryTopic(running), now: saturday })?.id).toBe('c5');
    expect(coachOfTheWeek(pool, { cityKey: null, readerId: null, topic: onlineTopic(), now: saturday })).toBeNull();
  });
});

describe('topics', () => {
  it('knows the words of every activity the list seeds', () => {
    for (const slug of [
      'strength', 'running', 'yoga', 'pilates', 'hiit', 'cycling', 'swimming',
      'combat', 'dance', 'mobility', 'outdoor', 'team-sports', 'prenatal', 'nutrition',
    ]) {
      expect(CATEGORY_WORDS[slug]?.length, slug).toBeGreaterThan(0);
    }
  });

  it('matches the start of a word, accents and case aside, in both languages', () => {
    expect(textMatchesWords(['Forță pentru începători'], CATEGORY_WORDS['strength'])).toBe(true);
    expect(textMatchesWords(['Alergăm în Cluj'], CATEGORY_WORDS['running'])).toBe(true);
    expect(textMatchesWords(['1-on-1 Strength'], CATEGORY_WORDS['strength'])).toBe(true);
    expect(textMatchesWords(['Brunch club'], CATEGORY_WORDS['running'])).toBe(false);
    expect(textMatchesWords([null, ''], CATEGORY_WORDS['running'])).toBe(false);
    expect(textMatchesWords(['Yoga'], [])).toBe(false);
  });

  it('goes by categories when an item has them, by its words when it has none', () => {
    const topic = categoryTopic(running);
    expect(coachMatchesTopic(coach({ categoryIds: [running.id] }), topic)).toBe(true);
    // Categories decide once there are some: the word alone no longer counts.
    expect(coachMatchesTopic(coach({ categoryIds: [yoga.id], specializations: ['Alergare'] }), topic)).toBe(false);
    expect(coachMatchesTopic(coach({ specializations: ['Alergare'] }), topic)).toBe(true);
    expect(coachMatchesTopic(coach(), topic)).toBe(false);
    expect(coachMatchesTopic(coach(), null)).toBe(true);
    expect(groupMatchesTopic(group({ categoryIds: [running.id] }), topic)).toBe(true);
    expect(groupMatchesTopic(group({ name: 'Alergăm în Cluj' }), topic)).toBe(true);
    expect(groupMatchesTopic(group(), topic)).toBe(false);
    expect(sessionMatchesTopic(instance(), categoryTopic(yoga))).toBe(true); // "Evening yoga flow"
  });

  it('online is a venue for a coach, where it happens for a session, words for a group', () => {
    const online = onlineTopic();
    expect(coachMatchesTopic(coach({ isOnline: true }), online)).toBe(true);
    expect(coachMatchesTopic(coach({ specializations: ['Online'] }), online)).toBe(false);
    expect(groupMatchesTopic(group({ name: 'Online run club' }), online)).toBe(true);
    expect(sessionMatchesTopic(instance(), online)).toBe(true);
    expect(sessionMatchesTopic(instance({ locationKind: SessionLocationKind.InPerson }), online)).toBe(false);
  });

  it('For you is the activities the reader picked, never their goals', () => {
    const forYou = forYouTopic(ACTIVITIES, [running.id, loseFat.id]);
    expect(forYou?.id).toBe(DiscoverTopicIds.ForYou);
    expect(forYou?.categoryIds).toEqual([running.id]);
    expect(forYouTopic(ACTIVITIES, [loseFat.id])).toBeNull();
    expect(forYouTopic(ACTIVITIES, [])).toBeNull();
  });

  it('offers only chips with something to show, Online only when something is online', () => {
    const pool = {
      coaches: [coach({ categoryIds: [running.id] })],
      groups: [],
      sessions: [],
    };
    const chips = discoverTopicChips(ACTIVITIES, [running.id], pool);
    expect(chips.map((chip) => chip.id)).toEqual([DiscoverTopicIds.ForYou, 'running']);
    // No For you when what the reader likes is not here.
    expect(discoverTopicChips(ACTIVITIES, [yoga.id], pool).map((chip) => chip.id)).toEqual([
      'running',
    ]);
    const online = { ...pool, coaches: [coach({ categoryIds: [running.id], isOnline: true })] };
    expect(discoverTopicChips(ACTIVITIES, [], online).map((chip) => chip.id)).toEqual([
      'running',
      DiscoverTopicIds.Online,
    ]);
  });

  it('keeps the picked chip while it is picked, even with nothing left to show', () => {
    const empty = { coaches: [], groups: [], sessions: [] };
    expect(discoverTopicChips(ACTIVITIES, [running.id], empty)).toEqual([]);
    expect(discoverTopicChips(ACTIVITIES, [], empty, 'yoga').map((chip) => chip.id)).toEqual([
      'yoga',
    ]);
    expect(
      discoverTopicChips(ACTIVITIES, [running.id], empty, DiscoverTopicIds.ForYou).map(
        (chip) => chip.id,
      ),
    ).toEqual([DiscoverTopicIds.ForYou]);
    expect(
      discoverTopicChips(ACTIVITIES, [], empty, DiscoverTopicIds.Online).map((chip) => chip.id),
    ).toEqual([DiscoverTopicIds.Online]);
  });

  it('caps the activity chips, and keeps a picked one past the cap', () => {
    const many: Category[] = Array.from({ length: TOPIC_CHIP_LIMIT + 3 }, (_, index) =>
      category(`a${index}`, 'ACTIVITY', index),
    );
    const pool = {
      coaches: many.map((c) => coach({ categoryIds: [c.id] })),
      groups: [],
      sessions: [],
    };
    // The activities alone: nobody here is online.
    expect(discoverTopicChips(many, [], pool)).toHaveLength(TOPIC_CHIP_LIMIT);
    const late = many[TOPIC_CHIP_LIMIT + 1].slug;
    const chips = discoverTopicChips(many, [], pool, late);
    expect(chips).toHaveLength(TOPIC_CHIP_LIMIT + 1);
    expect(chips.at(-1)?.id).toBe(late);
  });

  it('browses For you when the reader picked some, then every activity, then Online', () => {
    expect(browseTopics(ACTIVITIES, []).map((topic) => topic.id)).toEqual([
      'running',
      'yoga',
      DiscoverTopicIds.Online,
    ]);
    expect(browseTopics(ACTIVITIES, [yoga.id, loseFat.id]).map((topic) => topic.id)).toEqual([
      DiscoverTopicIds.ForYou,
      'running',
      'yoga',
      DiscoverTopicIds.Online,
    ]);
  });

  it('draws a registered glyph for a category whatever the API names', () => {
    expect(categoryTopic(category('x', 'ACTIVITY', 1, 'rocket-outline')).icon).toBe('ellipse-outline');
    expect(categoryTopic(running).icon).toBe('footsteps-outline');
  });
});

describe('cities', () => {
  it('one key per city however it is spelled', () => {
    expect(cityKey('Timișoara')).toBe(cityKey('Timisoara'));
    expect(cityKey('  Cluj-Napoca ')).toBe('cluj-napoca');
    expect(cityKey('Bucharest')).toBe(cityKey('București'));
    expect(cityKey('  ')).toBeNull();
    expect(cityKey(null)).toBeNull();
  });

  it('lists every city once, by name, keeping the spelling with accents', () => {
    const inPerson = { ...instance({ locationKind: SessionLocationKind.InPerson }) };
    inPerson.template = { ...inPerson.template!, venue: { id: 'v', name: 'Park', city: 'Iași', kind: 'PARK' } };
    expect(
      discoverCities(
        [coach({ city: 'Bucharest' }), coach({ id: 'p2', city: null })],
        [group({ city: 'București' }), group({ id: 'g2', city: 'Cluj-Napoca' })],
        [inPerson, instance()],
      ),
    ).toEqual([
      { key: 'bucuresti', label: 'București' },
      { key: 'cluj-napoca', label: 'Cluj-Napoca' },
      { key: 'iasi', label: 'Iași' },
    ]);
  });

  const cities = [
    { key: 'cluj-napoca', label: 'Cluj-Napoca' },
    { key: 'bucuresti', label: 'București' },
  ];

  it('shows the picked city, else the reader\'s own, else everywhere', () => {
    expect(resolveCity('bucuresti', 'Cluj-Napoca', cities)?.label).toBe('București');
    expect(resolveCity(null, 'Cluj-Napoca', cities)?.label).toBe('Cluj-Napoca');
    expect(resolveCity(EVERYWHERE, 'Cluj-Napoca', cities)).toBeNull();
    // Nothing in the reader's city: everywhere, never an empty tab.
    expect(resolveCity(null, 'Timisoara', cities)).toBeNull();
    // A pick with nothing in it any more falls back too.
    expect(resolveCity('iasi', 'Bucharest', cities)?.label).toBe('București');
  });

  it('filters by the city, with online sessions in every one', () => {
    expect(inCity('Cluj-Napoca', 'cluj-napoca')).toBe(true);
    expect(inCity(null, 'cluj-napoca')).toBe(false);
    expect(inCity(null, null)).toBe(true);
    expect(sessionInCity(instance(), 'cluj-napoca')).toBe(true);
    expect(sessionInCity(instance({ locationKind: SessionLocationKind.InPerson }), 'cluj-napoca')).toBe(false);
  });
});

describe('group verbs', () => {
  it('Join an open group, Request one that asks first, nothing once asked', () => {
    expect(groupVerb(group())).toEqual({ verb: GroupVerbs.Join, label: 'Join' });
    expect(groupVerb(group({ joinPolicy: JoinPolicies.Approval }))).toEqual({ verb: GroupVerbs.Request, label: 'Request' });
    expect(groupVerb(group({ myJoinRequestStatus: 'PENDING' }))).toBeNull();
    expect(groupVerb(group({ joinPolicy: JoinPolicies.InviteOnly }))).toBeNull();
  });
});

describe('search highlight', () => {
  const marked = (text: string, term: string) =>
    highlightParts(text, term)
      .map((part) => (part.match ? `[${part.text}]` : part.text))
      .join('');

  it('marks every match, blind to case and accents', () => {
    expect(marked('Forță pentru începători', 'forta')).toBe('[Forță] pentru începători');
    expect(marked('Strength (forță) · forta', 'FORȚA')).toBe('Strength ([forță]) · [forta]');
    expect(marked('Alergăm în Cluj', 'alergam in')).toBe('[Alergăm în] Cluj');
  });

  it('keeps a combining accent with its letter', () => {
    const decomposed = 'Fortă'.normalize('NFD');
    const parts = highlightParts(decomposed, 'forta');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ text: decomposed, match: true });
  });

  it('is the plain text without a term or a match', () => {
    expect(highlightParts('Yoga', '')).toEqual([{ text: 'Yoga', match: false }]);
    expect(highlightParts('Yoga', 'run')).toEqual([{ text: 'Yoga', match: false }]);
  });

  it('accentVariant names the spelling with accents that matched', () => {
    expect(accentVariant(['Irina Moldovan', 'Forță · Alergare'], 'forta')).toBe('forță');
    expect(accentVariant(['Forta club'], 'forta')).toBeNull(); // case is not an accent
    expect(accentVariant(['Forta club'], 'forță')).toBe('forta');
    expect(accentVariant(['Yoga'], 'forta')).toBeNull();
  });
});

describe('recents', () => {
  const query = (text: string): DiscoverRecent => ({ kind: RecentKinds.Query, text });
  const irina: DiscoverRecent = {
    kind: RecentKinds.Coach,
    id: 'c1',
    userId: 'u1',
    handle: 'irina',
    name: 'Irina Moldovan',
    avatarUrl: null,
    city: 'Cluj-Napoca',
  };

  it('puts the newest first, moves a repeat to the top, keeps five', () => {
    let list: DiscoverRecent[] = [];
    for (const text of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) list = pushRecent(list, query(text));
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]).toEqual(query('f6'));
    list = pushRecent(list, query('C3'));
    expect(list.filter((entry) => entry.kind === RecentKinds.Query && entry.text.toLowerCase() === 'c3')).toHaveLength(1);
    expect(list[0]).toEqual(query('C3'));
    list = pushRecent(pushRecent(list, irina), irina);
    expect(list.filter((entry) => entry.kind === RecentKinds.Coach)).toHaveLength(1);
  });

  it('a search typed with or without accents is one entry', () => {
    expect(pushRecent([query('forță')], query('forta'))).toEqual([query('forta')]);
  });

  it('reads back only well-formed entries', () => {
    expect(parseRecents('nope')).toEqual([]);
    expect(parseRecents([query('ok'), { kind: 'query', text: ' ' }, { kind: 'coach', id: 'x' }, irina, null])).toEqual([
      query('ok'),
      irina,
    ]);
  });
});

describe('discoverLinks', () => {
  it('keeps Discover\'s own routes in Discover', () => {
    const links = discoverLinks('/tabs/discover/search');
    expect(links.root).toBe('/tabs/discover');
    expect(links.person('irina')).toEqual(['/tabs/discover/person', 'irina']);
    expect(links.groupPreview('g1')).toEqual(['/tabs/discover/group', 'g1']);
    expect(links.group('g1')).toEqual(['/tabs/discover/groups', 'g1']);
    expect(links.session('s1')).toEqual(['/tabs/discover', 's1']);
    expect(links.allGroups).toBe('/tabs/discover/groups');
    expect(links.search).toBe('/tabs/discover/search');
  });

  it('opens everything in Home\'s stack when mounted there', () => {
    const links = discoverLinks('/tabs/home/search');
    expect(links.root).toBe('/tabs/home');
    expect(links.person('irina')).toEqual(['/tabs/home/person', 'irina']);
    expect(links.groupPreview('g1')).toEqual(['/tabs/home/groups', 'preview', 'g1']);
    expect(links.group('g1')).toEqual(['/tabs/home/groups', 'g1']);
    expect(links.session('s1')).toEqual(['/tabs/home', 'booking', 's1']);
    expect(links.allGroups).toBe('/tabs/home/groups-to-join');
  });

  it('falls back to Discover anywhere else', () => {
    expect(discoverLinks('/tabs/more').root).toBe('/tabs/discover');
  });
});
