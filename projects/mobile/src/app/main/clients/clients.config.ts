import {
  InstructorClient,
  InstructorClientStatuses,
  clientDisplayName,
  clientEmail,
  clientStatusLabel,
  isIncomingRequest,
  isOpenableClient,
  isSentInvite,
  translate,
} from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import {
  RecentPerson,
  SUGGESTION_LIMIT,
  SuggestedPerson,
} from '../../_shared/config/recent-searches.config';

/**
 * What a client row looks like and what can be done to one: the status tone
 * map, the verb registries behind the ⋮ sheet and the request sheet, and the
 * note field's limits.
 *
 * The rest of this feature's configuration sits beside this file, one seam
 * per concern, so a page imports only what it renders:
 *   `clients.icons.ts`    the icon registry every screen here registers
 *   `clients.filters.ts`  the status chips and the search floor
 *   `roster-labels.ts`    plain language over the roster numbers (client detail)
 *   `invite.utils.ts`     the invite sheet's modes, expiry and link
 *   `requests.utils.ts`   the request sheet's date labels
 * Address validation lives in core (`email.utils`) — the web invite dialog
 * has to agree with the sheet here about what a valid address is.
 */

/**
 * Status chip tone on a client row. Active rows are chip-silent — the
 * default state says nothing, like a booked session — so only the exceptions
 * get a wash.
 */
export type ClientStatusTone = 'warning' | 'medium' | null;

export function clientStatusTone(client: InstructorClient): ClientStatusTone {
  switch (client.status) {
    case InstructorClientStatuses.Pending:
      return 'warning';
    case InstructorClientStatuses.Archived:
      return 'medium';
    default:
      return null;
  }
}

/** A row without an account has no address to show under the address. */
export function clientSubline(client: InstructorClient): string {
  return client.client ? clientEmail(client) : translate('clients.row.notOnPlatform');
}

// ── Client actions ──────────────────────────────────────────────────────────

export const ClientActionIds = {
  Message: 'message',
  ViewProfile: 'viewProfile',
  EditNotes: 'editNotes',
  Unarchive: 'unarchive',
  Archive: 'archive',
} as const;

export type ClientActionId = (typeof ClientActionIds)[keyof typeof ClientActionIds];

export type ClientAction = SheetAction<ClientActionId>;

/**
 * The verbs on a client — the ⋮ on the detail screen. Message is the primary
 * one and takes honey; the plumbing verb stays neutral, restoring is green,
 * and archiving is red and last. None of these encode a state.
 */
export const CLIENT_ACTIONS: readonly ClientAction[] = [
  {
    id: ClientActionIds.Message,
    label: 'clients.actions.message',
    icon: 'chatbubble-outline',
    color: 'primary',
  },
  {
    id: ClientActionIds.ViewProfile,
    label: 'clients.actions.viewProfile',
    icon: 'person-outline',
    color: 'medium',
  },
  {
    id: ClientActionIds.EditNotes,
    label: 'clients.actions.editNotes',
    icon: 'create-outline',
    color: 'medium',
  },
  {
    id: ClientActionIds.Unarchive,
    label: 'clients.actions.unarchiveClient',
    icon: 'arrow-undo-outline',
    color: 'success',
  },
  {
    id: ClientActionIds.Archive,
    label: 'clients.actions.archiveClientEllipsis',
    icon: 'archive-outline',
    color: 'danger',
    destructive: true,
  },
];

/**
 * Only the verbs that can do something for this row. Messaging and the
 * public profile need an account on the other end; notes and archiving need
 * a settled relationship;
 * archive and unarchive are each other's undo, so exactly one shows.
 */
export function visibleClientActions(client: InstructorClient): ClientAction[] {
  const active = client.status === InstructorClientStatuses.Active;
  const archived = client.status === InstructorClientStatuses.Archived;

  return CLIENT_ACTIONS.filter((action) => {
    switch (action.id) {
      case ClientActionIds.Message:
        return !!client.client;
      case ClientActionIds.ViewProfile:
        return !!client.client?.handle;
      case ClientActionIds.EditNotes:
        return active || archived;
      case ClientActionIds.Archive:
        return active;
      case ClientActionIds.Unarchive:
        return archived;
      default:
        return true;
    }
  });
}

// ── Request actions ─────────────────────────────────────────────────────────

export const RequestActionIds = {
  Accept: 'accept',
  Resend: 'resend',
  ViewProfile: 'viewProfile',
  Decline: 'decline',
  Withdraw: 'withdraw',
} as const;

export type RequestActionId = (typeof RequestActionIds)[keyof typeof RequestActionIds];

export type RequestAction = SheetAction<RequestActionId>;

/**
 * The verbs on a pending row — the sheet a tap on one opens. An incoming
 * request is a decision (accept or decline), a sent invitation only needs
 * patience (resend or withdraw); each takes honey on the verb that moves it
 * forward and red on the one that ends it. Declining fires on the tap, as on
 * web, since the person can ask again; withdrawing asks first, because the
 * link in their inbox stops working.
 */
export const REQUEST_ACTIONS: readonly RequestAction[] = [
  {
    id: RequestActionIds.Accept,
    label: 'clients.actions.acceptRequest',
    icon: 'checkmark-circle-outline',
    color: 'primary',
  },
  {
    id: RequestActionIds.Resend,
    label: 'clients.actions.resendInvitation',
    icon: 'send-outline',
    color: 'primary',
  },
  {
    id: RequestActionIds.ViewProfile,
    label: 'clients.actions.viewProfile',
    icon: 'person-outline',
    color: 'medium',
  },
  {
    id: RequestActionIds.Decline,
    label: 'clients.actions.declineRequest',
    icon: 'close-circle-outline',
    color: 'danger',
    destructive: true,
  },
  {
    id: RequestActionIds.Withdraw,
    label: 'clients.actions.withdrawInvitationEllipsis',
    icon: 'close-circle-outline',
    color: 'danger',
    destructive: true,
  },
];

/**
 * The verbs for one pending row, by direction. A row that is neither is not
 * a request and gets none. `resent` marks an invitation already resent on
 * this visit: the verb stays, disabled and saying so, rather than vanishing.
 */
export function visibleRequestActions(client: InstructorClient, resent = false): RequestAction[] {
  const incoming = isIncomingRequest(client);
  const sent = isSentInvite(client);
  if (!incoming && !sent) return [];

  return REQUEST_ACTIONS.filter((action) => {
    switch (action.id) {
      case RequestActionIds.Accept:
      case RequestActionIds.Decline:
        return incoming;
      case RequestActionIds.Resend:
      case RequestActionIds.Withdraw:
        return sent;
      case RequestActionIds.ViewProfile:
        return !!client.client?.handle;
      default:
        return true;
    }
  }).map((action) =>
    action.id === RequestActionIds.Resend && resent
      ? { ...action, label: 'clients.actions.resent', disabled: true }
      : action,
  );
}

// ── Client notes ────────────────────────────────────────────────────────────

/**
 * Length ceiling on a private note, matching `UpdateClientDto`'s `@MaxLength`.
 * It is also the field's `maxlength`, so the two must agree — a server limit
 * above it turns the counter into decoration, and one below it rejects a note
 * the coach was told was fine.
 */
export const NOTES_MAX_LENGTH = 2000;

/**
 * Where the counter under the field starts showing — the last tenth of the
 * budget. A count from the first character ("19 / 2000") is noise about a
 * limit nobody is near; it only becomes information once it is a warning.
 */
export const NOTES_COUNTER_FROM = NOTES_MAX_LENGTH * 0.9;

// ── Search start ────────────────────────────────────────────────────────────

/**
 * A client as the tab's recent searches keep them, keyed by the person
 * (`clientId`), which is what the profile route takes. Null for a row with no
 * profile to open: a request or an invitation is not somewhere a search ends.
 */
export function recentFromClient(client: InstructorClient): RecentPerson | null {
  if (!isOpenableClient(client) || !client.clientId || !client.client) return null;
  return {
    id: client.clientId,
    name: clientDisplayName(client),
    avatarUrl: client.client.avatarUrl ?? null,
    subline: client.client.email || null,
  };
}

/**
 * The newest-clients strip: active clients, newest first. The API already
 * orders the list by when each relationship started, so this keeps its order.
 * Someone already in the recents is not offered twice.
 */
export function newestClients(
  clients: readonly InstructorClient[],
  excludeIds: readonly string[],
  limit = SUGGESTION_LIMIT,
): RecentPerson[] {
  const seen = new Set(excludeIds);
  const people: RecentPerson[] = [];

  for (const client of clients) {
    if (client.status !== InstructorClientStatuses.Active) continue;
    const person = recentFromClient(client);
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(person);
    if (people.length === limit) break;
  }
  return people;
}

/**
 * The pending strip above it: invitations the coach sent and requests sent
 * to them, newest first. Each carries its status word, which is said with
 * the name and sends the tap to the request sheet (there is no profile yet),
 * and an email-only invite its mail tile, as on the list row. Keyed by the
 * request, which is all an email-only invite has.
 */
export function pendingClients(
  clients: readonly InstructorClient[],
  limit = SUGGESTION_LIMIT,
): SuggestedPerson[] {
  return clients
    .filter((client) => isIncomingRequest(client) || isSentInvite(client))
    .slice(0, limit)
    .map((client) => ({
      id: client.id,
      name: clientDisplayName(client),
      avatarUrl: client.client?.avatarUrl ?? null,
      subline: null,
      pendingLabel: clientStatusLabel(client),
      icon: client.client ? null : 'mail-outline',
    }));
}
