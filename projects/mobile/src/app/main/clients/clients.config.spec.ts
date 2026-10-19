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
  ClientActionIds,
  NOTES_COUNTER_FROM,
  NOTES_MAX_LENGTH,
  REQUEST_ACTIONS,
  RequestActionIds,
  clientStatusTone,
  clientSubline,
  newestClients,
  pendingClients,
  recentFromClient,
  visibleClientActions,
  visibleRequestActions,
} from './clients.config';
import {
  CLIENT_FILTERS,
  CLIENT_REQUESTS_URL,
  ClientFilterIds,
  MIN_SEARCH_LENGTH,
  filterFromUrl,
  filterStatus,
  matchesClientQuery,
} from './clients.filters';
import { CLIENT_ICONS } from './clients.icons';
import { inviteLink } from './invite.utils';
import { daysBetween, receivedLabel, sentMetaLabel } from './requests.utils';
import { adherenceLabel, lastActiveLabel } from './roster-labels';

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

  // Home's banner and a request notification open the tab on the Requests
  // chip through the URL; nothing else may pick a chip that way.
  it('reads a chip from the tab root URL only', () => {
    expect(filterFromUrl(CLIENT_REQUESTS_URL)).toBe(ClientFilterIds.Requests);
    expect(filterFromUrl('/tabs/clients?requestId=r-1&filter=requests')).toBe(
      ClientFilterIds.Requests,
    );
    expect(filterFromUrl('/tabs/clients?filter=archived#top')).toBe(ClientFilterIds.Archived);
    expect(filterFromUrl('/tabs/clients')).toBeNull();
    expect(filterFromUrl('/tabs/clients?filter=nope')).toBeNull();
    expect(filterFromUrl('/tabs/clients/user-1?filter=requests')).toBeNull();
  });
});

describe('search start', () => {
  it('remembers a client by the person, with their address under the name', () => {
    expect(recentFromClient(client())).toEqual({
      id: 'user-1',
      name: 'Maria Ionescu',
      avatarUrl: null,
      subline: 'maria@example.com',
    });
  });

  // A request or an invitation has no profile, so a search never ends there.
  it('remembers nothing without a profile to open', () => {
    expect(
      recentFromClient(
        client({
          status: InstructorClientStatuses.Pending,
          requestType: ClientRequestTypes.ClientToInstructor,
        }),
      ),
    ).toBeNull();
    expect(recentFromClient(client({ clientId: null, client: null }))).toBeNull();
  });

  it('suggests active clients in list order, minus the recents, capped', () => {
    const rows = [
      client({ id: 'r1', clientId: 'u1', client: { id: 'u1', firstName: 'Ana' } }),
      client({
        id: 'r2',
        clientId: 'u2',
        status: InstructorClientStatuses.Archived,
        client: { id: 'u2', firstName: 'Bogdan' },
      }),
      client({ id: 'r3', clientId: 'u3', client: { id: 'u3', firstName: 'Corina' } }),
      client({ id: 'r4', clientId: 'u4', client: { id: 'u4', firstName: 'Dan' } }),
      client({ id: 'r5', clientId: 'u5', client: { id: 'u5', firstName: 'Elena' } }),
    ];

    expect(newestClients(rows, ['u3'], 2).map((person) => person.name)).toEqual(['Ana', 'Dan']);
  });

  // Waiting invitations get their own strip, and stay out of the newest
  // clients. They carry their status, said with the name, which also tells
  // the page to open the request sheet on a tap.
  it('lists waiting invitations and requests apart, keyed by the request, with their status', () => {
    const rows = [
      client({
        id: 'req-1',
        clientId: null,
        client: null,
        invitedEmail: 'new@example.com',
        status: InstructorClientStatuses.Pending,
        requestType: ClientRequestTypes.InstructorToClient,
      }),
      client(),
    ];

    const [invite, ...rest] = pendingClients(rows);
    expect(invite).toMatchObject({
      id: 'req-1',
      name: 'new@example.com',
      pendingLabel: 'Email sent',
      icon: 'mail-outline',
    });
    expect(rest).toEqual([]);
    expect(newestClients(rows, []).map((person) => person.id)).toEqual(['user-1']);
  });
});

describe('roster numbers', () => {
  // Null means nothing was due — not the same as 0%, which is a failure.
  it('shows a dash, not a zero, when nothing was due', () => {
    expect(adherenceLabel(roster({ adherencePercent: null }))).toBe('—');
    expect(adherenceLabel(roster({ adherencePercent: 0 }))).toBe('0%');
  });

  it('formats last active for the detail card', () => {
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 0 }))).toBe('Trained today');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 1 }))).toBe('Last active yesterday');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: 3 }))).toBe('Last active 3 days ago');
    expect(lastActiveLabel(roster({ daysSinceLastWorkout: null }))).toBeNull();
  });
});

describe('client rows', () => {
  // Active is the default state and says nothing; only the exceptions wear a chip.
  it('leaves active rows chip-silent', () => {
    expect(clientStatusTone(client())).toBeNull();
    expect(clientStatusTone(client({ status: InstructorClientStatuses.Pending }))).toBe('warning');
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
  // Address validation moved to core (`email.utils`), next to `client.utils`:
  // the web invite dialog has to agree with this sheet about what a valid
  // address is. Its cases live in `email.utils.spec.ts`.

  // The link must be the web app's signup page — inside the WebView,
  // `window.location.origin` is `capacitor://localhost` and goes nowhere.
  it('builds the invite link on the web signup address', () => {
    expect(inviteLink('abc123')).toBe(`${SIGNUP_URL}?token=abc123`);
    expect(inviteLink('a b/c')).toBe(`${SIGNUP_URL}?token=a%20b%2Fc`);
  });
});

describe('search floor', () => {
  // The API ignores a shorter term and answers with the unfiltered page,
  // which is indistinguishable from a page of matches — a single `a` came
  // back as the whole directory under a search box reading `a`. The floor
  // here is what tells the store to hold the term back and narrow in memory
  // instead, and it has to match the API's.
  it('matches the minimum the API and the invite sheet both use', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2);
  });
});

describe('client notes', () => {
  // The counter is information only as a warning; from the first character
  // it is noise about a limit nobody is near.
  it('starts the counter inside the last tenth of the budget', () => {
    expect(NOTES_COUNTER_FROM).toBe(1800);
    expect(NOTES_COUNTER_FROM).toBeLessThan(NOTES_MAX_LENGTH);
    expect(NOTES_COUNTER_FROM / NOTES_MAX_LENGTH).toBeCloseTo(0.9);
  });

  // The field's `maxlength` is this, and so is `UpdateClientDto`'s
  // `@MaxLength` — a server limit above it turns the counter into
  // decoration, one below it rejects a note the coach was told was fine.
  it('caps a note where the DTO does', () => {
    expect(NOTES_MAX_LENGTH).toBe(2000);
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

  it('offers the public profile only to someone with a handle, right after Message', () => {
    const withHandle = client({
      client: { id: 'user-1', firstName: 'Maria', lastName: 'Ionescu', handle: 'maria' },
    });
    expect(visibleClientActions(withHandle).map((a) => a.id).slice(0, 2)).toEqual([
      ClientActionIds.Message,
      ClientActionIds.ViewProfile,
    ]);
    expect(visibleClientActions(client()).map((a) => a.id)).not.toContain(
      ClientActionIds.ViewProfile,
    );
  });
});

describe('request actions', () => {
  const incoming = (overrides: Record<string, unknown> = {}) =>
    client({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.ClientToInstructor,
      ...overrides,
    });
  const sent = (overrides: Record<string, unknown> = {}) =>
    client({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
      ...overrides,
    });
  const ids = (row: InstructorClient, resent = false) =>
    visibleRequestActions(row, resent).map((a) => a.id);

  it('tints every verb with a palette colour Ionic knows', () => {
    const palette = ['primary', 'success', 'info', 'medium', 'danger'];
    for (const action of REQUEST_ACTIONS) {
      expect(palette).toContain(action.color);
    }
  });

  // The verb that ends the request is red and sorted into its own card; the
  // one that moves it forward is honey.
  it('marks only decline and withdraw destructive', () => {
    const destructive = REQUEST_ACTIONS.filter((action) => action.destructive);
    expect(destructive.map((action) => action.id)).toEqual([
      RequestActionIds.Decline,
      RequestActionIds.Withdraw,
    ]);
    for (const action of destructive) expect(action.color).toBe('danger');
  });

  it('offers a decision on an incoming request and patience on a sent one', () => {
    expect(ids(incoming())).toEqual([RequestActionIds.Accept, RequestActionIds.Decline]);
    expect(ids(sent())).toEqual([RequestActionIds.Resend, RequestActionIds.Withdraw]);
    expect(ids(sent({ client: null, clientId: null, invitedEmail: 'radu@x.com' }))).toEqual([
      RequestActionIds.Resend,
      RequestActionIds.Withdraw,
    ]);
  });

  it('offers the public profile only to someone with a handle', () => {
    const user = { id: 'user-1', firstName: 'Maria', lastName: 'Ionescu', handle: 'maria' };
    expect(ids(incoming({ client: user }))).toEqual([
      RequestActionIds.Accept,
      RequestActionIds.ViewProfile,
      RequestActionIds.Decline,
    ]);
    expect(ids(sent({ client: user }))).toContain(RequestActionIds.ViewProfile);
  });

  it('offers nothing on a row that is not a request', () => {
    expect(ids(client())).toEqual([]);
    expect(ids(client({ status: InstructorClientStatuses.Archived }))).toEqual([]);
  });

  // Once per visit is plenty: the verb stays, disabled and saying so.
  it('keeps a resent invitation verb in place but disabled', () => {
    const resend = visibleRequestActions(sent(), true).find(
      (a) => a.id === RequestActionIds.Resend,
    );
    expect(resend).toMatchObject({ label: 'clients.actions.resent', disabled: true });
    expect(
      visibleRequestActions(sent()).find((a) => a.id === RequestActionIds.Resend)?.disabled,
    ).toBeUndefined();
  });
});

describe('request sheet', () => {
  // Local noon, so a timezone offset cannot tip the day either way.
  const NOW = new Date('2026-08-30T12:00:00').getTime();

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
