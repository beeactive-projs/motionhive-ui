import {
  alertCircleOutline,
  archiveOutline,
  arrowUndoOutline,
  barbellOutline,
  chatbubbleOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  chevronForward,
  closeCircleOutline,
  cloudOfflineOutline,
  createOutline,
  ellipsisVertical,
  hourglassOutline,
  lockClosedOutline,
  mailOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
  searchOutline,
  shareOutline,
} from 'ionicons/icons';

import {
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  RosterAttention,
  RosterClient,
  RosterWindow,
  SIGNUP_URL,
  clientDisplayName,
  clientEmail,
  isIncomingRequest,
  isSentInvite,
  startOfDay,
} from 'core';

/**
 * Every icon the clients screens render. Each page calls
 * `addIcons(CLIENT_ICONS)` once, so a name in a template can never reference
 * an icon nobody registered.
 */
export const CLIENT_ICONS = {
  alertCircleOutline,
  archiveOutline,
  arrowUndoOutline,
  barbellOutline,
  chatbubbleOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  chevronForward,
  closeCircleOutline,
  cloudOfflineOutline,
  createOutline,
  ellipsisVertical,
  hourglassOutline,
  lockClosedOutline,
  mailOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
  searchOutline,
  shareOutline,
};

/** The two lenses on the same people: who needs a nudge, and everyone. */
export const ClientsSegments = {
  Attention: 'attention',
  All: 'all',
} as const;

export type ClientsSegment = (typeof ClientsSegments)[keyof typeof ClientsSegments];

export const ClientFilterIds = {
  All: 'all',
  Active: 'active',
  Requests: 'requests',
  Archived: 'archived',
} as const;

export type ClientFilterId = (typeof ClientFilterIds)[keyof typeof ClientFilterIds];

export interface ClientFilter {
  id: ClientFilterId;
  label: string;
  /** The server-side status the chip narrows to; none for "All". */
  status?: InstructorClientStatus;
}

/**
 * The quick-filter chips over the All clients list. "Requests" is the PENDING
 * status: the API folds invitations and incoming requests into one bucket.
 */
export const CLIENT_FILTERS: readonly ClientFilter[] = [
  { id: ClientFilterIds.All, label: 'All' },
  { id: ClientFilterIds.Active, label: 'Active', status: InstructorClientStatuses.Active },
  { id: ClientFilterIds.Requests, label: 'Requests', status: InstructorClientStatuses.Pending },
  { id: ClientFilterIds.Archived, label: 'Archived', status: InstructorClientStatuses.Archived },
];

export function filterStatus(id: ClientFilterId): InstructorClientStatus | undefined {
  return CLIENT_FILTERS.find((filter) => filter.id === id)?.status;
}

/** The triage reads "this week" — the roster's shorter window. */
export const ROSTER_WINDOW: RosterWindow = '1w';

/**
 * Spine colour for an attention reason. Semantic, never honey: a flagged
 * client is a state, not something to press.
 *   BEHIND / DROPPED        — the plan is slipping: red.
 *   NO_PLAN / NEVER_STARTED — nothing is happening yet: amber.
 *   SILENT                  — gone quiet: sky.
 */
export type AttentionTone = 'danger' | 'warning' | 'info';

export function attentionTone(attention: RosterAttention): AttentionTone | null {
  switch (attention) {
    case 'BEHIND':
    case 'DROPPED':
      return 'danger';
    case 'NO_PLAN':
    case 'NEVER_STARTED':
      return 'warning';
    case 'SILENT':
      return 'info';
    default:
      return null;
  }
}

/** Plain language, because a coach should not decode an enum. */
export function attentionLabel(client: RosterClient): string {
  switch (client.attention) {
    case 'NO_PLAN':
      return 'No plan assigned';
    case 'NEVER_STARTED':
      return 'Has not started';
    case 'SILENT':
      return `Inactive for ${client.daysSinceLastWorkout} days`;
    case 'DROPPED':
      return 'Dropping off';
    case 'BEHIND':
      return 'Behind plan';
    default:
      return '';
  }
}

/** One line saying what actually happened, for the screens with room for it. */
export function attentionDetail(client: RosterClient): string {
  switch (client.attention) {
    case 'NO_PLAN':
      return 'Nothing is assigned, so there is nothing for them to follow.';
    case 'NEVER_STARTED':
      return 'Assigned a plan but has never logged a workout.';
    case 'SILENT':
      return client.due > 0
        ? `${client.completed} of ${client.due} workouts done in this window.`
        : 'No workouts logged recently.';
    case 'DROPPED':
      return `Down from ${client.previousAdherencePercent}% to ${client.adherencePercent}% against the previous window.`;
    case 'BEHIND':
      return `${client.completed} of ${client.due} workouts done.`;
    default:
      return '';
  }
}

/** Null adherence means nothing was due, which is not the same as 0%. */
export function adherenceLabel(client: RosterClient): string {
  return client.adherencePercent == null ? '—' : `${client.adherencePercent}%`;
}

/** Nothing scheduled is a fact about the plan, not about the person. */
export function subtitleFor(client: RosterClient): string {
  if (client.due === 0) {
    return client.activePlans === 0 ? 'No active plan' : 'Nothing scheduled in this window';
  }
  return `${client.completed} of ${client.due} workouts`;
}

/** "today" / "3d ago" — the stat sub-line on a list row. Null when unknown. */
export function lastActiveShort(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  return days === 0 ? 'today' : `${days}d ago`;
}

/** The sentence form for the detail card. Null when unknown. */
export function lastActiveLabel(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  if (days === 0) return 'Trained today';
  if (days === 1) return 'Last active yesterday';
  return `Last active ${days} days ago`;
}

/** The mono block at a row's right edge: one number and what it is. */
export interface ClientStat {
  value: string;
  sub: string;
}

/**
 * What a flagged row shows on the right. A silent client's number is how
 * long they have been gone; everyone else's is their adherence.
 */
export function attentionStat(client: RosterClient): ClientStat {
  // Nothing assigned means no adherence to quote — "— adherence" would read
  // as a measurement that failed rather than a plan that was never written.
  if (client.attention === 'NO_PLAN') {
    return { value: '—', sub: 'no plan' };
  }
  if (client.attention === 'SILENT' && client.daysSinceLastWorkout !== null) {
    return { value: `${client.daysSinceLastWorkout}d`, sub: 'last active' };
  }
  return { value: adherenceLabel(client), sub: 'adherence' };
}

/** An on-track row: adherence, with when they last trained under it. */
export function onTrackStat(client: RosterClient): ClientStat {
  return { value: adherenceLabel(client), sub: lastActiveShort(client) ?? 'adherence' };
}

/**
 * "3 of 8 active clients need a look" — the line beside the triage kicker.
 *
 * "active" is load-bearing. The segment above reads "All clients · N", which
 * counts every row including invitations still in flight; this denominator is
 * the roster, which is active relationships only. Two different numbers on
 * one screen with nothing to tell them apart read as a contradiction.
 */
export function triageNote(needs: number, total: number): string {
  const noun = total === 1 ? 'active client' : 'active clients';
  const verb = needs === 1 ? 'needs' : 'need';
  return `${needs} of ${total} ${noun} ${verb} a look`;
}

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

/** Header search over the loaded rows: name or email, case-insensitive. */
export function matchesClientQuery(client: InstructorClient, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    clientDisplayName(client).toLowerCase().includes(term) ||
    clientEmail(client).toLowerCase().includes(term)
  );
}

/**
 * The same search over a roster row. The roster is a different shape from a
 * relationship — a name and a handle, no email — so it needs its own
 * predicate, but the search box above the two segments is one box and has to
 * narrow whichever list is under it.
 */
export function matchesRosterQuery(client: RosterClient, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    client.name.toLowerCase().includes(term) ||
    (client.handle?.toLowerCase().includes(term) ?? false)
  );
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
 * The counter under the field counts down from this, so the two must agree —
 * a server limit above it turns the counter into decoration, and one below it
 * rejects a note the coach was told was fine.
 */
export const NOTES_MAX_LENGTH = 2000;

// ── Invite sheet ────────────────────────────────────────────────────────────

/** The two ways in: someone already on MotionHive, or an address. */
export const InviteModes = {
  Platform: 'platform',
  Email: 'email',
} as const;

export type InviteMode = (typeof InviteModes)[keyof typeof InviteModes];

/**
 * Stated in the sheet's copy; the BE owns the real TTL and sets it to 30 days
 * (`expiresAt` on the created request, and again on every resend). This said
 * 14, so the sheet promised one thing and the Requests row — which renders
 * the server's own `expiresAt` — said another about the same invitation.
 */
export const INVITE_EXPIRY_DAYS = 30;

/**
 * RFC 5321's ceiling on an address, and on its local part. The first is also
 * the input's `maxlength`, so the field cannot hold something the BE will
 * always refuse.
 */
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;

/**
 * Dot-separated atoms, never doubled and never at an edge. The punctuation is
 * RFC 5322's atext set, which is wide — but it excludes the characters that
 * let `<script>@x.com` through before.
 */
const EMAIL_LOCAL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

/**
 * Labels that start and end alphanumeric, and a TLD of at least two letters.
 * Rejects the empty label in `b..c` and the leading hyphen in `-b.com`.
 */
const EMAIL_DOMAIN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/**
 * Enough to stop a typo, not a full RFC 5322 parse.
 *
 * Deliberately tracks class-validator's `@IsEmail()` on the BE's invitation
 * DTO rather than sitting looser than it: a check that enables Send on an
 * address the BE then rejects turns a typo into a round trip and a toast.
 */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;

  const at = email.lastIndexOf('@');
  if (at < 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) return false;

  return EMAIL_LOCAL.test(local) && EMAIL_DOMAIN.test(domain);
}

/**
 * What to say under the field, or null when there is nothing to say. Empty is
 * not an error — a field nobody has filled in yet has not gone wrong, and
 * Send is disabled anyway.
 */
export function emailErrorMessage(value: string): string | null {
  const email = value.trim();
  if (!email) return null;
  if (email.length > EMAIL_MAX_LENGTH) {
    return `An email address cannot be longer than ${EMAIL_MAX_LENGTH} characters.`;
  }
  return isValidEmail(email) ? null : 'Enter a valid email address, like client@example.com.';
}

/**
 * Where an email invite's link lands. Built on the web app's address, never
 * `window.location` — inside the WebView that is `capacitor://localhost`.
 */
export function inviteLink(token: string): string {
  return `${SIGNUP_URL}?token=${encodeURIComponent(token)}`;
}

// ── Requests page ───────────────────────────────────────────────────────────

/**
 * The pending rows, split by who is waiting on whom. The API returns both
 * directions in one list; the page shows them as two sections because they
 * ask different things of the coach — a decision, or patience.
 */
export function splitPendingRows(rows: readonly InstructorClient[]): {
  incoming: InstructorClient[];
  sent: InstructorClient[];
} {
  return {
    incoming: rows.filter(isIncomingRequest),
    sent: rows.filter(isSentInvite),
  };
}

/** Whole local days from `iso` up to `now` — negative when `iso` is ahead. */
export function daysBetween(iso: string, now: number): number {
  const from = startOfDay(new Date(iso)).getTime();
  const to = startOfDay(new Date(now)).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** "Received today" / "Received yesterday" / "Received 3 days ago". */
export function receivedLabel(iso: string, now: number): string {
  const days = daysBetween(iso, now);
  if (days <= 0) return 'Received today';
  if (days === 1) return 'Received yesterday';
  return `Received ${days} days ago`;
}

/**
 * "Sent 3 days ago · expires in 11 days" — how long they have had it, and
 * how long it still stands. The API drops expired rows, so the expiry never
 * reads in the past.
 */
export function sentMetaLabel(row: InstructorClient, now: number): string {
  const sentDays = daysBetween(row.createdAt, now);
  const sent =
    sentDays <= 0 ? 'Sent today' : sentDays === 1 ? 'Sent yesterday' : `Sent ${sentDays} days ago`;
  if (!row.expiresAt) return sent;

  const left = -daysBetween(row.expiresAt, now);
  const expires =
    left <= 0 ? 'expires today' : left === 1 ? 'expires tomorrow' : `expires in ${left} days`;
  return `${sent} · ${expires}`;
}
