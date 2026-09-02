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
  createOutline,
  ellipseOutline,
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
  createOutline,
  ellipseOutline,
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
 *   BEHIND / DROPPED — the plan is slipping: red.
 *   NEVER_STARTED    — assigned but untouched: amber.
 *   SILENT           — gone quiet: sky.
 */
export type AttentionTone = 'danger' | 'warning' | 'info';

export function attentionTone(attention: RosterAttention): AttentionTone | null {
  switch (attention) {
    case 'BEHIND':
    case 'DROPPED':
      return 'danger';
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
  if (client.attention === 'SILENT' && client.daysSinceLastWorkout !== null) {
    return { value: `${client.daysSinceLastWorkout}d`, sub: 'last active' };
  }
  return { value: adherenceLabel(client), sub: 'adherence' };
}

/** An on-track row: adherence, with when they last trained under it. */
export function onTrackStat(client: RosterClient): ClientStat {
  return { value: adherenceLabel(client), sub: lastActiveShort(client) ?? 'adherence' };
}

/** "3 of 8 clients need a look" — the line beside the triage kicker. */
export function triageNote(needs: number, total: number): string {
  const noun = total === 1 ? 'client' : 'clients';
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

// ── Invite sheet ────────────────────────────────────────────────────────────

/** The two ways in: someone already on MotionHive, or an address. */
export const InviteModes = {
  Platform: 'platform',
  Email: 'email',
} as const;

export type InviteMode = (typeof InviteModes)[keyof typeof InviteModes];

/** Stated in the sheet's copy; the BE owns the real TTL. */
export const INVITE_EXPIRY_DAYS = 14;

/**
 * Enough to stop a typo, not a full RFC 5322 parse — the BE validates for
 * real, and an over-strict check here would refuse addresses the BE takes.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
