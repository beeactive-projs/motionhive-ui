import {
  ClientRequestTypes,
  ClientStatusLabels,
  InstructorClientStatuses,
  PendingClientLabels,
} from '../models/client/client.enums';
import { InstructorClient } from '../models/client/client.model';
import { displayName } from './messaging.utils';

/**
 * Display helpers over the coach's client rows — pure functions, shared by the
 * web clients pages and the mobile Clients tab so the two cannot drift.
 *
 * One row shape covers two sources: real `instructor_client` relationships and
 * pending `client_request` rows (invitations and incoming requests), which the
 * API normalises into the same `InstructorClient` envelope. A request row has
 * `requestType` set and carries the request id in `id`; a relationship row has
 * no `requestType`. Most of what follows keys off that discriminator.
 */

/** "First Last", or the invited address for someone not on the platform yet. */
export function clientDisplayName(client: InstructorClient, fallback = 'This client'): string {
  if (client.client) return displayName(client.client, fallback);
  return client.invitedEmail ?? fallback;
}

export function clientEmail(client: InstructorClient): string {
  return client.client?.email || client.invitedEmail || '—';
}

/**
 * The status word a row shows. PENDING is split three ways by who started it
 * and whether the other side has an account: Invited (platform user), Email
 * sent (address only), Request (they asked to join).
 */
export function clientStatusLabel(client: InstructorClient): string {
  if (client.status !== InstructorClientStatuses.Pending) {
    return ClientStatusLabels[client.status];
  }
  if (client.requestType === ClientRequestTypes.InstructorToClient) {
    return client.client ? PendingClientLabels.Invited : PendingClientLabels.EmailSent;
  }
  return PendingClientLabels.Request;
}

/**
 * Whether this row has a profile to open.
 *
 * `requestType` is the discriminator, not `status` — a request row carries a
 * `clientId` for an existing user and would otherwise look openable, then 404.
 * A PENDING relationship row is fine to open.
 */
export function isOpenableClient(client: InstructorClient): boolean {
  return !!client.clientId && !client.requestType;
}

/** A trainee asked to be coached — the coach's decision is still owed. */
export function isIncomingRequest(client: InstructorClient): boolean {
  return (
    client.status === InstructorClientStatuses.Pending &&
    client.requestType === ClientRequestTypes.ClientToInstructor
  );
}

/** The coach invited someone (by account or by email) and they have not answered. */
export function isSentInvite(client: InstructorClient): boolean {
  return (
    client.status === InstructorClientStatuses.Pending &&
    client.requestType === ClientRequestTypes.InstructorToClient
  );
}
