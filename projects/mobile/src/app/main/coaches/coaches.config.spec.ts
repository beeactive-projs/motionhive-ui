/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  ClientRequest,
  ClientRequestTypes,
  CoachDirectorySorts,
  InstructorSearchResult,
  MyInstructor,
  User,
} from 'core';

import { MY_COACHES_URL } from '../../_shared/utils/stack-paths';
import {
  COACH_ACTIONS,
  CoachActionIds,
  CoachRowKinds,
  incomingInvites,
  invitedLabel,
  myCoachRows,
  recentFromCoach,
  sinceLabel,
  takingClientsStrip,
  visibleCoachActions,
  yourCoachesStrip,
} from './coaches.config';
import {
  COACHES_BACK_DEFAULT,
  COACHES_URL,
  COACHES_YOURS_URL,
  CoachFilterIds,
  DirectoryRequest,
  NO_SHEET_FILTERS,
  backHrefFrom,
  directoryParams,
  filterFromUrl,
  matchesCoachQuery,
  narrowsDirectory,
  nearYouCity,
  sheetFilterCount,
  sheetNarrows,
} from './coaches.filters';
import { COACH_ICONS } from './coaches.icons';

/** Every template in this feature, inlined at build time by Vite. */
const templates = import.meta.glob('./**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The component sources too — rows assembled in TypeScript carry `icon:` literals. */
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
 * Icon names this feature can render: static attributes, kebab literals inside
 * conditional bindings, and `icon:` literals on rows built in TypeScript.
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

  // Ionic's own components name these; we never register them.
  names.delete('crescent');
  return [...names];
}

const registered = new Set(Object.keys(COACH_ICONS));

describe('COACH_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as CLIENT_ICONS.
  it('registers every icon the coaches screen renders', () => {
    const used = iconNamesUsed();
    expect(used.length).toBeGreaterThan(0);

    for (const name of used) {
      expect(registered, `${name} is used but not registered`).toContain(toCamelCase(name));
    }
  });

  it('registers nothing the screen does not use', () => {
    const used = new Set(iconNamesUsed().map(toCamelCase));

    for (const key of registered) {
      expect(used, `${key} is registered but unused`).toContain(key);
    }
  });
});

/** 2026-08-30T12:00 local — the clock every day label below is read against. */
const NOW = new Date('2026-08-30T12:00:00').getTime();

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'coach-user-1',
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Moldovan',
    handle: 'anamoldovan',
    isActive: true,
    isEmailVerified: true,
    roles: [],
    permissions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function request(overrides: Partial<ClientRequest> = {}): ClientRequest {
  return {
    id: 'req-1',
    fromUserId: 'coach-user-1',
    toUserId: 'me',
    invitedEmail: null,
    type: ClientRequestTypes.InstructorToClient,
    message: null,
    status: 'PENDING',
    token: null,
    expiresAt: '2026-09-29T12:00:00.000Z',
    respondedAt: null,
    createdAt: '2026-08-30T09:00:00',
    fromUser: user(),
    ...overrides,
  };
}

function instructor(overrides: Partial<MyInstructor> = {}): MyInstructor {
  return {
    id: 'rel-1',
    instructorId: 'coach-user-1',
    clientId: 'me',
    status: 'ACTIVE',
    startedAt: '2026-03-14T10:00:00',
    instructor: user(),
    instructorProfile: null,
    ...overrides,
  };
}

describe('shaping pending requests', () => {
  // Reading the wrong end of a request describes the reader to themselves
  // ("Invited you: You").
  it('reads a coach invitation off fromUser and keeps the request id', () => {
    const [row] = incomingInvites([request()], NOW);

    expect(row.id).toBe('req-1');
    expect(row.person.name).toBe('Ana Moldovan');
    expect(row.handle).toBe('anamoldovan');
    expect(row.userId).toBe('coach-user-1');
  });

  // The endpoint returns incoming requests only, but a row pointing the
  // other way must never be drawn as "a coach invited you" if it widens.
  it('leaves out a request the reader sent', () => {
    const rows = [request(), request({ id: 'req-2', type: ClientRequestTypes.ClientToInstructor })];

    expect(incomingInvites(rows, NOW).map((row) => row.id)).toEqual(['req-1']);
  });

  // A request whose other end the API did not expand still has to render.
  it('names an unexpanded end rather than rendering a blank row', () => {
    const [row] = incomingInvites([request({ fromUser: undefined })], NOW);

    expect(row.person.name).toBe('a coach');
    expect(row.userId).toBeNull();
  });
});

describe('day labels', () => {
  it('says today, yesterday, then a count', () => {
    expect(invitedLabel('2026-08-30T01:00:00', NOW)).toBe('Invited you today');
    expect(invitedLabel('2026-08-29T23:30:00', NOW)).toBe('Invited you yesterday');
    expect(invitedLabel('2026-08-27T18:00:00', NOW)).toBe('Invited you 3 days ago');
  });
});

describe('myCoachRows', () => {
  it('keys leaving on the instructor id and says since when', () => {
    const [row] = myCoachRows([instructor()]);

    expect(row.id).toBe('rel-1');
    expect(row.instructorId).toBe('coach-user-1');
    expect(row.person.subline).toBe(sinceLabel('2026-03-14T10:00:00'));
    expect(row.person.subline).toContain('March');
  });

  // The coaching profile's name is the one the public profile and Discover
  // show, so the coaches page must not fall back to the legal name beside them.
  it('prefers the coaching profile display name', () => {
    const [row] = myCoachRows([
      instructor({
        instructorProfile: {
          userId: 'coach-user-1',
          displayName: 'Coach Ana',
          specializations: [],
          bio: null,
        },
      }),
    ]);

    expect(row.person.name).toBe('Coach Ana');
  });

  it('ignores a blank display name', () => {
    const [row] = myCoachRows([
      instructor({
        instructorProfile: {
          userId: 'coach-user-1',
          displayName: '   ',
          specializations: [],
          bio: null,
        },
      }),
    ]);

    expect(row.person.name).toBe('Ana Moldovan');
  });
});

describe('visibleCoachActions', () => {
  const ids = (actions: readonly { id: string }[]) => actions.map((action) => action.id);

  it('offers a decision on an invitation', () => {
    expect(ids(visibleCoachActions(CoachRowKinds.Invite, { handle: null }))).toEqual([
      CoachActionIds.Accept,
      CoachActionIds.Decline,
    ]);
  });

  it('offers messaging and leaving on a settled relationship', () => {
    expect(
      ids(visibleCoachActions(CoachRowKinds.Coach, { handle: 'ana', userId: 'coach-user-1' })),
    ).toEqual([CoachActionIds.Message, CoachActionIds.ViewProfile, CoachActionIds.Leave]);
  });

  // Leaving keys on the relationship, not on the coach's account, so it must
  // survive an unexpanded user — otherwise the one way out disappears.
  it('keeps leaving when the coach account is not expanded', () => {
    const actions = ids(visibleCoachActions(CoachRowKinds.Coach, { userId: null }));

    expect(actions).toContain(CoachActionIds.Leave);
    expect(actions).not.toContain(CoachActionIds.Message);
  });

  it('hides the public profile without a handle', () => {
    expect(ids(visibleCoachActions(CoachRowKinds.Invite, { handle: 'ana' }))).toContain(
      CoachActionIds.ViewProfile,
    );
    expect(ids(visibleCoachActions(CoachRowKinds.Invite, {}))).not.toContain(
      CoachActionIds.ViewProfile,
    );
  });

  // Red means it ends something, and the sheet sorts those into their own card.
  it('marks only the verbs that end something destructive', () => {
    const destructive = COACH_ACTIONS.filter((action) => action.destructive).map(
      (action) => action.id,
    );

    expect(destructive).toEqual([CoachActionIds.Decline, CoachActionIds.Leave]);
  });
});

// ── The directory ────────────────────────────────────────────────────────────

function coach(overrides: Partial<InstructorSearchResult> = {}): InstructorSearchResult {
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
    city: 'Cluj-Napoca',
    countryCode: 'RO',
    socialLinks: null,
    ...overrides,
  };
}

function directoryRequest(overrides: Partial<DirectoryRequest> = {}): DirectoryRequest {
  return {
    filter: CoachFilterIds.All,
    sheet: NO_SHEET_FILTERS,
    query: '',
    nearCity: null,
    searching: false,
    page: 1,
    limit: 20,
    ...overrides,
  };
}

describe('directory URLs', () => {
  // `_shared` spells the Menu's URL out; the two must never drift apart.
  it('agrees with the shared Yours URL', () => {
    expect(COACHES_YOURS_URL).toBe(MY_COACHES_URL);
  });

  it('reads the chip off the screen root only', () => {
    expect(filterFromUrl('/tabs/coaches?filter=yours')).toBe(CoachFilterIds.Yours);
    expect(filterFromUrl('/tabs/coaches')).toBeNull();
    expect(filterFromUrl('/tabs/coaches?filter=nope')).toBeNull();
    expect(filterFromUrl('/tabs/coaches/person/ana?filter=yours')).toBeNull();
  });

  // Three doors, one back: whichever the reader came through.
  it('goes back to the screen it was opened from', () => {
    expect(backHrefFrom('/tabs/home', COACHES_BACK_DEFAULT)).toBe('/tabs/home');
    expect(backHrefFrom('/tabs/more?x=1', COACHES_BACK_DEFAULT)).toBe('/tabs/more');
  });

  it('keeps its target on a return from inside its own stack', () => {
    expect(backHrefFrom('/tabs/coaches/person/ana', '/tabs/home')).toBe('/tabs/home');
    expect(backHrefFrom('/tabs/coaches/notifications', '/tabs/more')).toBe('/tabs/more');
    expect(backHrefFrom('/tabs/coaches?filter=yours', '/tabs/more')).toBe('/tabs/more');
    expect(backHrefFrom(null, COACHES_BACK_DEFAULT)).toBe(COACHES_BACK_DEFAULT);
    expect(backHrefFrom('/auth/login', COACHES_BACK_DEFAULT)).toBe(COACHES_BACK_DEFAULT);
  });
});

describe('directoryParams', () => {
  it('asks for a bare recommended page with nothing picked', () => {
    const params = directoryParams(directoryRequest());
    expect(params).toEqual({ page: 1, limit: 20, sort: CoachDirectorySorts.Recommended });
    expect(narrowsDirectory(params)).toBe(false);
  });

  it('turns each quick chip into its filter', () => {
    const forChip = (filter: DirectoryRequest['filter'], nearCity: string | null = null) =>
      directoryParams(directoryRequest({ filter, nearCity }));

    expect(forChip(CoachFilterIds.Requests).requested).toBe(true);
    expect(forChip(CoachFilterIds.Online).online).toBe(true);
    expect(forChip(CoachFilterIds.NearYou, 'Cluj-Napoca').city).toBe('Cluj-Napoca');
    expect(narrowsDirectory(forChip(CoachFilterIds.Requests))).toBe(true);
  });

  // The Filters chip is unlit on Requests, so a pick left in the sheet must
  // not hide a request with nothing on screen saying so.
  it('lists every request the reader sent, whatever the sheet holds', () => {
    const params = directoryParams(
      directoryRequest({
        filter: CoachFilterIds.Requests,
        sheet: { ...NO_SHEET_FILTERS, sort: CoachDirectorySorts.Name, city: 'București' },
      }),
    );
    expect(params).toEqual({
      page: 1,
      limit: 20,
      sort: CoachDirectorySorts.Recommended,
      requested: true,
    });
  });

  it('opens on Requests from the URL', () => {
    expect(filterFromUrl(`${COACHES_URL}?filter=requests`)).toBe(CoachFilterIds.Requests);
    expect(filterFromUrl(`${COACHES_URL}?filter=accepting`)).toBeNull();
  });

  // Yours lists the reader's own coaches, so the directory behind it is All:
  // coming back to All reloads nothing.
  it('reads Yours as All', () => {
    expect(directoryParams(directoryRequest({ filter: CoachFilterIds.Yours }))).toEqual(
      directoryParams(directoryRequest()),
    );
  });

  it("lets the sheet's city win over Near you", () => {
    const params = directoryParams(
      directoryRequest({
        filter: CoachFilterIds.NearYou,
        nearCity: 'Cluj-Napoca',
        sheet: { ...NO_SHEET_FILTERS, city: 'București' },
      }),
    );
    expect(params.city).toBe('București');
  });

  it('sends the sheet picks', () => {
    const params = directoryParams(
      directoryRequest({
        sheet: {
          sort: CoachDirectorySorts.Experience,
          specializations: ['Yoga', 'Forță'],
          city: null,
          minYears: 5,
        },
      }),
    );
    expect(params).toMatchObject({
      sort: CoachDirectorySorts.Experience,
      specializations: ['Yoga', 'Forță'],
      minYears: 5,
    });
    expect(narrowsDirectory(params)).toBe(true);
  });

  // The chips and the sheet fold away while searching, so they must not
  // narrow results with nothing on screen saying so. The sort still holds.
  it('searches the whole directory, keeping only the sort', () => {
    const params = directoryParams(
      directoryRequest({
        searching: true,
        query: 'ana',
        filter: CoachFilterIds.Online,
        sheet: { ...NO_SHEET_FILTERS, sort: CoachDirectorySorts.Name, minYears: 10 },
      }),
    );
    expect(params).toEqual({
      page: 1,
      limit: 20,
      sort: CoachDirectorySorts.Name,
      search: 'ana',
    });
  });
});

describe('the filter sheet', () => {
  it('counts each pick, and a sort other than the default', () => {
    expect(sheetFilterCount(NO_SHEET_FILTERS)).toBe(0);
    expect(
      sheetFilterCount({
        sort: CoachDirectorySorts.Name,
        specializations: ['Yoga', 'Pilates'],
        city: 'Cluj-Napoca',
        minYears: 2,
      }),
    ).toBe(5);
  });

  it('tells a reorder apart from a narrowing', () => {
    expect(sheetNarrows({ ...NO_SHEET_FILTERS, sort: CoachDirectorySorts.Name })).toBe(false);
    expect(sheetNarrows({ ...NO_SHEET_FILTERS, minYears: 5 })).toBe(true);
  });
});

describe('nearYouCity', () => {
  const cities = [
    { label: 'Cluj-Napoca', count: 3 },
    { label: 'București', count: 2 },
  ];

  it("prefers the city Discover shows, then the reader's own", () => {
    expect(nearYouCity('bucuresti', 'Cluj', cities)).toBe('București');
    expect(nearYouCity(null, 'cluj-napoca', cities)).toBe('Cluj-Napoca');
  });

  // Discover's "Everywhere" is what to browse, not where the reader is.
  it('falls through Everywhere to the account city', () => {
    expect(nearYouCity('everywhere', 'Bucharest', cities)).toBe('București');
  });

  it('is null where the directory has no coach, so the chip hides', () => {
    expect(nearYouCity(null, 'Timișoara', cities)).toBeNull();
    expect(nearYouCity(null, null, cities)).toBeNull();
  });
});

describe('search start', () => {
  it('remembers a coach by handle, and not one without a profile', () => {
    expect(recentFromCoach(coach())).toEqual({
      id: 'usr-1',
      name: 'Ana Popescu',
      avatarUrl: null,
      subline: 'Yoga · Cluj-Napoca',
      handle: 'ana',
    });
    expect(recentFromCoach(coach({ handle: null }))).toBeNull();
  });

  it("suggests open coaches who are not the reader's, asked or already recent", () => {
    const rows = [
      coach(),
      coach({ id: 'p2', userId: 'usr-2', handle: 'ion', isAcceptingClients: false }),
      coach({ id: 'p3', userId: 'usr-3', handle: 'eva' }),
      coach({ id: 'p4', userId: 'usr-4', handle: 'dan' }),
      coach({ id: 'p5', userId: 'usr-5', handle: 'ana', requestSent: true }),
    ];
    expect(takingClientsStrip(rows, ['usr-3']).map((person) => person.id)).toEqual([
      'usr-1',
      'usr-4',
    ]);
  });

  it("offers the reader's coaches with a handle, recents left out", () => {
    const rows = myCoachRows([
      instructor(),
      instructor({ id: 'rel-2', instructorId: 'u2', instructor: user({ id: 'u2', handle: 'ion' }) }),
      instructor({ id: 'rel-3', instructorId: 'u3', instructor: user({ id: 'u3', handle: null }) }),
    ]);
    const strip = yourCoachesStrip(rows, ['coach-user-1']);
    expect(strip.map((person) => person.handle)).toEqual(['ion']);
  });

  it('narrows the loaded rows by name, city or specialty, accents aside', () => {
    expect(matchesCoachQuery(coach({ specializations: ['Forță'] }), 'forta')).toBe(true);
    expect(matchesCoachQuery(coach(), 'cluj')).toBe(true);
    expect(matchesCoachQuery(coach(), 'popes')).toBe(true);
    expect(matchesCoachQuery(coach(), 'boxing')).toBe(false);
  });
});
