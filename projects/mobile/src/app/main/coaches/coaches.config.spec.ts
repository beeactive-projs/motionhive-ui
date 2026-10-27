/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { ClientRequest, ClientRequestTypes, MyInstructor, User } from 'core';

import {
  COACH_ACTIONS,
  CoachActionIds,
  CoachRowKinds,
  incomingInvites,
  invitedLabel,
  myCoachRows,
  sinceLabel,
  visibleCoachActions,
} from './coaches.config';
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
