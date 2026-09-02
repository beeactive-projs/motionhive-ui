import { describe, expect, it } from 'vitest';

import {
  ClientRequestTypes,
  InstructorClientStatus,
  InstructorClientStatuses,
} from '../models/client/client.enums';
import { InstructorClient } from '../models/client/client.model';
import {
  clientDisplayName,
  clientEmail,
  clientStatusLabel,
  isIncomingRequest,
  isOpenableClient,
  isSentInvite,
} from './client.utils';

/**
 * Only the fields the helpers read. Loosely typed on purpose: the model
 * declares `clientId` and `requestType` non-null, but the API sends null for
 * both on the request rows these helpers exist to tell apart.
 */
function row(
  overrides: Record<string, unknown> & { status: InstructorClientStatus },
): InstructorClient {
  return {
    id: 'row-1',
    instructorId: 'coach-1',
    clientId: 'user-1',
    initiatedBy: 'INSTRUCTOR',
    notes: null,
    startedAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    invitedEmail: null,
    expiresAt: null,
    ...overrides,
  } as unknown as InstructorClient;
}

const user = {
  id: 'user-1',
  email: 'maria@example.com',
  firstName: 'Maria',
  lastName: 'Ionescu',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('clientDisplayName / clientEmail', () => {
  it('reads the account when there is one', () => {
    const active = row({ status: InstructorClientStatuses.Active, client: user });
    expect(clientDisplayName(active)).toBe('Maria Ionescu');
    expect(clientEmail(active)).toBe('maria@example.com');
  });

  // An email-only invite has no account yet: the address is the only name
  // there is, and it doubles as the email line.
  it('falls back to the invited address for an email-only invite', () => {
    const invite = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
      clientId: null,
      invitedEmail: 'radu@example.com',
    });
    expect(clientDisplayName(invite)).toBe('radu@example.com');
    expect(clientEmail(invite)).toBe('radu@example.com');
  });

  it('uses the caller-supplied fallback when nothing is usable', () => {
    const blank = row({ status: InstructorClientStatuses.Active, clientId: null });
    expect(clientDisplayName(blank)).toBe('This client');
    expect(clientDisplayName(blank, 'this client')).toBe('this client');
    expect(clientEmail(blank)).toBe('—');
  });
});

describe('clientStatusLabel', () => {
  it('names the settled statuses plainly', () => {
    expect(clientStatusLabel(row({ status: InstructorClientStatuses.Active }))).toBe('Active');
    expect(clientStatusLabel(row({ status: InstructorClientStatuses.Archived }))).toBe(
      'Archived',
    );
  });

  // PENDING is three different situations, and the discriminator between the
  // first two is the presence of an account — not the invited address.
  it('splits pending by direction and by whether they have an account', () => {
    const invited = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
      client: user,
    });
    const emailed = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
      clientId: null,
      invitedEmail: 'radu@example.com',
    });
    const request = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.ClientToInstructor,
      client: user,
    });

    expect(clientStatusLabel(invited)).toBe('Invited');
    expect(clientStatusLabel(emailed)).toBe('Email sent');
    expect(clientStatusLabel(request)).toBe('Request');
  });
});

describe('isOpenableClient', () => {
  it('opens relationship rows, pending ones included', () => {
    expect(isOpenableClient(row({ status: InstructorClientStatuses.Active }))).toBe(true);
    expect(isOpenableClient(row({ status: InstructorClientStatuses.Archived }))).toBe(true);
    expect(
      isOpenableClient(row({ status: InstructorClientStatuses.Pending, requestType: null })),
    ).toBe(true);
  });

  // A request row for an existing user carries their id and would 404 on open.
  it('never opens a request row, even one with a user id', () => {
    expect(
      isOpenableClient(
        row({
          status: InstructorClientStatuses.Pending,
          requestType: ClientRequestTypes.ClientToInstructor,
          client: user,
        }),
      ),
    ).toBe(false);
    expect(
      isOpenableClient(
        row({
          status: InstructorClientStatuses.Pending,
          requestType: ClientRequestTypes.InstructorToClient,
          clientId: null,
        }),
      ),
    ).toBe(false);
  });
});

describe('isIncomingRequest / isSentInvite', () => {
  it('tells the two pending directions apart', () => {
    const incoming = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.ClientToInstructor,
    });
    const sent = row({
      status: InstructorClientStatuses.Pending,
      requestType: ClientRequestTypes.InstructorToClient,
    });

    expect(isIncomingRequest(incoming)).toBe(true);
    expect(isSentInvite(incoming)).toBe(false);
    expect(isIncomingRequest(sent)).toBe(false);
    expect(isSentInvite(sent)).toBe(true);
  });

  it('is false for anything settled', () => {
    const active = row({
      status: InstructorClientStatuses.Active,
      requestType: ClientRequestTypes.ClientToInstructor,
    });
    expect(isIncomingRequest(active)).toBe(false);
    expect(isSentInvite(active)).toBe(false);
  });
});
