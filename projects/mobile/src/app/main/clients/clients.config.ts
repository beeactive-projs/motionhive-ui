import { InstructorClient, InstructorClientStatuses, clientEmail } from 'core';

/**
 * What a client row looks like and what can be done to one: the status tone
 * map, the verb registry behind the ⋮ sheet, and the note field's limits.
 *
 * The rest of this feature's configuration sits beside this file, one seam
 * per concern, so a page imports only what it renders:
 *   `clients.icons.ts`    the icon registry every screen here registers
 *   `clients.filters.ts`  the two lenses, the chips, and the search floor
 *   `roster-labels.ts`    plain language over the roster's enums and numbers
 *   `invite.utils.ts`     the invite sheet's modes, expiry and link
 *   `requests.utils.ts`   the Requests page's direction split and date labels
 * Address validation lives in core (`email.utils`) — the web invite dialog
 * has to agree with the sheet here about what a valid address is.
 */

/**
 * Status chip tone on an All clients row. Active rows are chip-silent — the
 * default state says nothing, like a booked session — so only the exceptions
 * get a wash.
 */
export type ClientStatusTone = 'warn' | 'medium' | null;

export function clientStatusTone(client: InstructorClient): ClientStatusTone {
  switch (client.status) {
    case InstructorClientStatuses.Pending:
      return 'warn';
    case InstructorClientStatuses.Archived:
      return 'medium';
    default:
      return null;
  }
}

/** A row without an account has no address to show under the address. */
export function clientSubline(client: InstructorClient): string {
  return client.client ? clientEmail(client) : 'Not on MotionHive yet';
}

// ── Client actions ──────────────────────────────────────────────────────────

export const ClientActionIds = {
  Message: 'message',
  EditNotes: 'editNotes',
  Unarchive: 'unarchive',
  Archive: 'archive',
} as const;

export type ClientActionId = (typeof ClientActionIds)[keyof typeof ClientActionIds];

export interface ClientAction {
  id: ClientActionId;
  label: string;
  icon: string;
  /** Ionic palette name for the leading glyph. */
  color: string;
  destructive?: boolean;
}

/**
 * The verbs on a client — the ⋮ on the detail screen. Message is the primary
 * one and takes honey; the plumbing verb stays neutral, restoring is green,
 * and archiving is red and last. None of these encode a state.
 */
export const CLIENT_ACTIONS: readonly ClientAction[] = [
  { id: ClientActionIds.Message, label: 'Message', icon: 'chatbubble-outline', color: 'primary' },
  { id: ClientActionIds.EditNotes, label: 'Edit notes', icon: 'create-outline', color: 'medium' },
  {
    id: ClientActionIds.Unarchive,
    label: 'Unarchive client',
    icon: 'arrow-undo-outline',
    color: 'success',
  },
  {
    id: ClientActionIds.Archive,
    label: 'Archive client…',
    icon: 'archive-outline',
    color: 'danger',
    destructive: true,
  },
];

/**
 * Only the verbs that can do something for this row. Messaging needs an
 * account on the other end; notes and archiving need a settled relationship;
 * archive and unarchive are each other's undo, so exactly one shows.
 */
export function visibleClientActions(client: InstructorClient): ClientAction[] {
  const active = client.status === InstructorClientStatuses.Active;
  const archived = client.status === InstructorClientStatuses.Archived;

  return CLIENT_ACTIONS.filter((action) => {
    switch (action.id) {
      case ClientActionIds.Message:
        return !!client.client;
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
