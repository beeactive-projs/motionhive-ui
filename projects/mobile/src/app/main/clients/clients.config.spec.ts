/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  ClientRequestTypes,
  InstructorClient,
  InstructorClientStatuses,
  RosterClient,
  SIGNUP_URL,
} from 'core';

import {
  CLIENT_ACTIONS,
  CLIENT_FILTERS,
  CLIENT_ICONS,
  ClientActionIds,
  ClientFilterIds,
  adherenceLabel,
  attentionLabel,
  attentionStat,
  attentionTone,
  clientStatusTone,
  clientSubline,
  daysBetween,
  filterStatus,
  inviteLink,
  isValidEmail,
  lastActiveLabel,
  lastActiveShort,
  matchesClientQuery,
  onTrackStat,
  receivedLabel,
  sentMetaLabel,
  splitPendingRows,
  subtitleFor,
  triageNote,
  visibleClientActions,
} from './clients.config';

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

const registered = new Set(Object.keys(CLIENT_ICONS));

describe('CLIENT_ICONS', () => {
  // An unregistered name renders as a blank box with no error anywhere, which
  // is exactly the kind of thing that ships. Same guard as SESSION_ICONS.
  it('registers every icon the clients screens render', () => {
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

/** A roster row with the numbers the helpers read; the rest is defaults. */
function roster(overrides: Partial<RosterClient> = {}): RosterClient {
  return {
    clientId: 'user-1',
    name: 'Maria Ionescu',
    avatarUrl: null,
    handle: null,
    due: 5,
    completed: 4,
    skipped: 1,
    adherencePercent: 80,
    previousAdherencePercent: null,
    lastWorkoutAt: null,
    daysSinceLastWorkout: 2,
    activePlans: 1,
    attention: null,
    ...overrides,
  };
}

/**
 * Loosely typed on purpose: the model declares `clientId` and `requestType`
 * non-null, but the API sends null for both on request rows.
 */
function client(overrides: Record<string, unknown> = {}): InstructorClient {
  return {
    id: 'row-1',
    clientId: 'user-1',
    status: InstructorClientStatuses.Active,
    client: {
      id: 'user-1',
      firstName: 'Maria',
      lastName: 'Ionescu',
      email: 'maria@example.com',
    },
    invitedEmail: null,
    requestType: null,
    ...overrides,
  } as unknown as InstructorClient;
}

describe('filters', () => {
  it('maps each chip to the status the API filters on, and All to none', () => {
    expect(filterStatus(ClientFilterIds.All)).toBeUndefined();
    expect(filterStatus(ClientFilterIds.Active)).toBe('ACTIVE');
    expect(filterStatus(ClientFilterIds.Requests)).toBe('PENDING');
    expect(filterStatus(ClientFilterIds.Archived)).toBe('ARCHIVED');
    expect(CLIENT_FILTERS.map((f) => f.id)).toEqual(['all', 'active', 'requests', 'archived']);
  });
});

describe('attention', () => {
  // Honey is the action colour, so no reason may map to it — a flagged client
  // is a state to read, not a button to press.
  it('keys each reason to a semantic spine, never honey', () => {
    expect(attentionTone('BEHIND')).toBe('danger');
    expect(attentionTone('DROPPED')).toBe('danger');
    expect(attentionTone('NEVER_STARTED')).toBe('warning');
    expect(attentionTone('SILENT')).toBe('info');
    expect(attentionTone(null)).toBeNull();
  });

  it('says why in plain words', () => {
    expect(attentionLabel(roster({ attention: 'BEHIND' }))).toBe('Behind plan');
    expect(attentionLabel(roster({ attention: 'DROPPED' }))).toBe('Dropping off');
    expect(attentionLabel(roster({ attention: 'NEVER_STARTED' }))).toBe('Has not started');
    expect(attentionLabel(roster({ attention: 'SILENT', daysSinceLastWorkout: 21 }))).toBe(
      'Inactive for 21 days',
    );
    expect(attentionLabel(roster())).toBe('');
  });

  // A silent client's number is how long they have been gone; everyone
  // else's is adherence.
  it('puts the right number on the right of the row', () => {
    expect(attentionStat(roster({ attention: 'SILENT', daysSinceLastWorkout: 21 }))).toEqual({
      value: '21d',
      sub: 'last active',
    });
    expect(attentionStat(roster({ attention: 'BEHIND', adherencePercent: 42 }))).toEqual({
      value: '42%',
      sub: 'adherence',
    });
  });
});

describe('roster numbers', () => {
  // Null means nothing was due — not the same as 0%, which is a failure.
  it('shows a dash, not a zero, when nothing was due', () => {
    expect(adherenceLabel(roster({ adherencePercent: null }))).toBe('—');
    expect(adherenceLabel(roster({ adherencePercent: 0 }))).toBe('0%');
  });

  it('describes the plan, not the person, when nothing is scheduled', () => {
    expect(subtitleFor(roster({ due: 0, activePlans: 0 }))).toBe('No active plan');
    expect(subtitleFor(roster({ due: 0, activePlans: 1 }))).toBe(
      'Nothing scheduled in this window',
    );
    expect(subtitleFor(roster({ due: 5, completed: 4 }))).toBe('4 of 5 workouts');
  });

  it('formats last active for a row and for a card', () => {
    expect(lastActiveShort(roster({ daysSinceLastWorkout: 0 }))).toBe('today');
    expect(lastActiveShort(roster({ daysSinceLastWorkout: 3 }))).toBe('3d ago');
    expect(lastActiveShort(roster({ daysSinceLastWorkout: null }))).toBeNull();

    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 0 }))).toBe('Trained today');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 1 }))).toBe('Last active yesterday');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 3 }))).toBe('Last active 3 days ago');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: null }))).toBeNull();
  });

  it('falls back to naming the number when last-active is unknown', () => {
    expect(onTrackStat(roster({ daysSinceLastWorkout: null }))).toEqual({
      value: '80%',
      sub: 'adherence',
    });
    expect(onTrackStat(roster({ daysSinceLastWorkout: 2 }))).toEqual({
      value: '80%',
      sub: '2d ago',
    });
  });

  it('agrees the triage note with its numbers', () => {
    expect(triageNote(3, 8)).toBe('3 of 8 clients need a look');
    expect(triageNote(1, 8)).toBe('1 of 8 clients needs a look');
    expect(triageNote(1, 1)).toBe('1 of 1 client needs a look');
  });
});

describe('All clients rows', () => {
  // Active is the default state and says nothing; only the exceptions wear a chip.
  it('leaves active rows chip-silent', () => {
    expect(clientStatusTone(client())).toBeNull();
    expect(clientStatusTone(client({ status: InstructorClientStatuses.Pending }))).toBe('warn');
    expect(clientStatusTone(client({ status: InstructorClientStatuses.Archived }))).toBe('medium');
  });

  it('does not repeat an email-only invite address under itself', () => {
    expect(clientSubline(client())).toBe('maria@example.com');
    expect(
      clientSubline(client({ client: undefined, clientId: null, invitedEmail: 'radu@x.com' })),
    ).toBe('Not on MotionHive yet');
  });

  it('searches name and email, ignoring case and padding', () => {
    expect(matchesClientQuery(client(), '  IONES ')).toBe(true);
    expect(matchesClientQuery(client(), 'maria@')).toBe(true);
    expect(matchesClientQuery(client(), 'radu')).toBe(false);
    expect(matchesClientQuery(client(), '   ')).toBe(true);
    expect(
      matchesClientQuery(
        client({ client: undefined, clientId: null, invitedEmail: 'radu@x.com' }),
        'radu',
      ),
    ).toBe(true);
  });
});

describe('invite sheet', () => {
  // Enough to catch a typo before the request; the BE is the real validator.
  it('accepts an address and refuses what cannot be one', () => {
    expect(isValidEmail('radu@example.com')).toBe(true);
    expect(isValidEmail('  radu@example.com ')).toBe(true);
    expect(isValidEmail('radu')).toBe(false);
    expect(isValidEmail('radu@')).toBe(false);
    expect(isValidEmail('radu@example')).toBe(false);
    expect(isValidEmail('ra du@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  // The link must be the web app's signup page — inside the WebView,
  // `window.location.origin` is `capacitor://localhost` and goes nowhere.
  it('builds the invite link on the web signup address', () => {
    expect(inviteLink('abc123')).toBe(`${SIGNUP_URL}?token=abc123`);
    expect(inviteLink('a b/c')).toBe(`${SIGNUP_URL}?token=a%20b%2Fc`);
  });
});

describe('client actions', () => {
  // A colour Ionic cannot resolve is not an error — the glyph silently falls
  // back to the item's ink, so a typo shows up as one row quietly losing its tint.
  it('tints every verb with a palette colour Ionic knows', () => {
    const palette = ['primary', 'success', 'info', 'medium', 'danger'];
    for (const action of CLIENT_ACTIONS) {
      expect(palette).toContain(action.color);
    }
  });

  // Honey is the brand's "act here" colour, so exactly one row may wear it.
  it('spends honey on the primary verb alone', () => {
    const honey = CLIENT_ACTIONS.filter((action) => action.color === 'primary');
    expect(honey.map((action) => action.id)).toEqual([ClientActionIds.Message]);
  });

  it('marks archive, and only archive, destructive — and keeps it last', () => {
    const destructive = CLIENT_ACTIONS.filter((action) => action.destructive);
    expect(destructive.map((action) => action.id)).toEqual([ClientActionIds.Archive]);
    expect(destructive[0].color).toBe('danger');
    expect(CLIENT_ACTIONS[CLIENT_ACTIONS.length - 1].id).toBe(ClientActionIds.Archive);
  });

  it('offers archive or unarchive, never both, and notes only on a settled row', () => {
    const ids = (row: InstructorClient) => visibleClientActions(row).map((a) => a.id);

    expect(ids(client())).toEqual([
      ClientActionIds.Message,
      ClientActionIds.EditNotes,
      ClientActionIds.Archive,
    ]);
    expect(ids(client({ status: InstructorClientStatuses.Archived }))).toEqual([
      ClientActionIds.Message,
      ClientActionIds.EditNotes,
      ClientActionIds.Unarchive,
    ]);
    expect(ids(client({ status: InstructorClientStatuses.Pending }))).toEqual([
      ClientActionIds.Message,
    ]);
  });

  it('never offers to message someone without an account', () => {
    const emailOnly = client({ client: undefined, clientId: null, invitedEmail: 'radu@x.com' });
    expect(visibleClientActions(emailOnly).map((a) => a.id)).not.toContain(
      ClientActionIds.Message,
    );
  });
});

describe('requests page', () => {
  // Local noon, so a timezone offset cannot tip the day either way.
  const NOW = new Date('2026-08-30T12:00:00').getTime();

  it('splits pending rows by direction and drops anything settled', () => {
    const incoming = client({
      id: 'r-1',
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.ClientToInstructor,
    });
    const sent = client({
      id: 'r-2',
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
    });
    const active = client({ id: 'r-3' });

    const split = splitPendingRows([active, sent, incoming]);
    expect(split.incoming.map((r) => r.id)).toEqual(['r-1']);
    expect(split.sent.map((r) => r.id)).toEqual(['r-2']);
  });

  it('counts whole local days, not elapsed hours', () => {
    expect(daysBetween('2026-08-30T01:00:00', NOW)).toBe(0);
    expect(daysBetween('2026-08-29T23:30:00', NOW)).toBe(1);
    expect(daysBetween('2026-08-27T18:00:00', NOW)).toBe(3);
    expect(daysBetween('2026-09-02T09:00:00', NOW)).toBe(-3);
  });

  it('says when a request came in, in words', () => {
    expect(receivedLabel('2026-08-30T08:00:00', NOW)).toBe('Received today');
    expect(receivedLabel('2026-08-29T08:00:00', NOW)).toBe('Received yesterday');
    expect(receivedLabel('2026-08-27T08:00:00', NOW)).toBe('Received 3 days ago');
  });

  it('pairs how long ago with how long left on a sent invite', () => {
    const row = client({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
      createdAt: '2026-08-27T08:00:00',
      expiresAt: '2026-09-10T08:00:00',
    });
    expect(sentMetaLabel(row, NOW)).toBe('Sent 3 days ago · expires in 11 days');

    expect(
      sentMetaLabel(
        client({ createdAt: '2026-08-30T08:00:00', expiresAt: '2026-08-31T08:00:00' }),
        NOW,
      ),
    ).toBe('Sent today · expires tomorrow');

    expect(
      sentMetaLabel(
        client({ createdAt: '2026-08-29T08:00:00', expiresAt: '2026-08-30T20:00:00' }),
        NOW,
      ),
    ).toBe('Sent yesterday · expires today');

    expect(sentMetaLabel(client({ createdAt: '2026-08-29T08:00:00', expiresAt: null }), NOW)).toBe(
      'Sent yesterday',
    );
  });
});
