import {
  ClientRequest,
  ClientRequestTypes,
  MyInstructor,
  appLocale,
  displayName,
  translate,
} from 'core';

import { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import { RecentPerson } from '../../_shared/config/recent-searches.config';
import { daysBetween } from '../../_shared/utils/dates';

/**
 * The trainee's side of a coaching relationship: what the coaches page shows
 * and what can be done to each row.
 *
 * Two API calls feed two lists. `GET /clients/my-instructors` gives the
 * settled relationships; `GET /clients/requests/pending` gives the requests
 * waiting on this reader's answer.
 *
 * That second endpoint returns INCOMING requests only — verified against the
 * API: with three outgoing requests on the account it answered `[]`, and
 * returned the row the moment a coach invited the reader. So the rows here
 * are always coach invitations, and `type` is still checked rather than
 * assumed, in case the endpoint ever widens. A trainee's own requests to a
 * coach have no endpoint to read them back from, so this screen does not
 * claim to show them.
 *
 * Everything here is pure, so `coaches.config.spec.ts` can cover the shaping
 * and the verb registries without standing up the page.
 */

// ── Rows ────────────────────────────────────────────────────────────────────

/**
 * A pending invitation as a row. `id` is the request id — what accept and
 * decline key on — and never a user id, which is the mistake that answers
 * the wrong request.
 */
export interface CoachRequestRow {
  id: string;
  person: RecentPerson;
  /** For "View profile"; null when the other side never picked a handle. */
  handle: string | null;
  /** The coach's user id, for a draft message. Null on a row with no account. */
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** A settled relationship. `instructorId` is what leaving keys on. */
export interface MyCoachRow {
  /** The relationship id — the row's identity in the list. */
  id: string;
  instructorId: string;
  person: RecentPerson;
  handle: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** "Invited you today" / "Invited you yesterday" / "Invited you 3 days ago". */
export function invitedLabel(iso: string, now: number): string {
  const days = daysBetween(iso, now);
  if (days <= 0) return translate('coaches.row.invited.today');
  if (days === 1) return translate('coaches.row.invited.yesterday');
  return translate('coaches.row.invited.daysAgo', { count: days });
}

/** "Coaching you since March 2026" — the month a relationship started. */
export function sinceLabel(iso: string): string {
  const date = new Date(iso).toLocaleDateString(appLocale(), {
    month: 'long',
    year: 'numeric',
  });
  return translate('coaches.row.since', { date });
}

/**
 * Invitations waiting on this reader's answer — a coach invited them.
 *
 * The inviting coach is `fromUser`: the API addresses a request by who sent
 * it, so reading `toUser` here would describe the reader to themselves.
 */
export function incomingInvites(
  requests: readonly ClientRequest[],
  now: number,
): CoachRequestRow[] {
  return requests
    .filter((request) => request.type === ClientRequestTypes.InstructorToClient)
    .map((request) => requestRow(request, request.fromUser, invitedLabel(request.createdAt, now)));
}

/** The reader's coaches, as rows. Order is the API's — newest relationship first. */
export function myCoachRows(instructors: readonly MyInstructor[]): MyCoachRow[] {
  return instructors.map((item) => ({
    id: item.id,
    instructorId: item.instructorId,
    handle: item.instructor?.handle ?? null,
    firstName: item.instructor?.firstName ?? null,
    lastName: item.instructor?.lastName ?? null,
    person: {
      id: item.instructor?.id ?? item.instructorId,
      name: coachName(item),
      avatarUrl: item.instructor?.avatarUrl ?? null,
      subline: sinceLabel(item.startedAt),
    },
  }));
}

/**
 * The coach's name, preferring the coaching profile's display name: that is
 * the name they chose to be coached under, and it is what the public profile
 * and Discover show.
 */
function coachName(item: MyInstructor): string {
  const chosen = item.instructorProfile?.displayName?.trim();
  if (chosen) return chosen;
  const fallback = translate('coaches.aCoach');
  return item.instructor ? displayName(item.instructor, fallback) : fallback;
}

/** One request row. `user` is whichever end of it is not the reader. */
function requestRow(
  request: ClientRequest,
  user: ClientRequest['fromUser'],
  subline: string,
): CoachRequestRow {
  const fallback = translate('coaches.aCoach');
  return {
    id: request.id,
    handle: user?.handle ?? null,
    userId: user?.id ?? null,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    person: {
      id: request.id,
      name: user ? displayName(user, fallback) : fallback,
      avatarUrl: user?.avatarUrl ?? null,
      subline,
    },
  };
}

// ── Verbs ───────────────────────────────────────────────────────────────────

export const CoachActionIds = {
  Accept: 'accept',
  Message: 'message',
  ViewProfile: 'viewProfile',
  Decline: 'decline',
  Leave: 'leave',
} as const;

export type CoachActionId = (typeof CoachActionIds)[keyof typeof CoachActionIds];

export type CoachAction = SheetAction<CoachActionId>;

/**
 * Which kind of row a sheet is about. The verbs differ enough between the
 * two that one flat list filtered by flags would read as a puzzle.
 */
export const CoachRowKinds = {
  /** A coach invited the reader: accept or decline. */
  Invite: 'invite',
  /** A settled relationship: message, or end it. */
  Coach: 'coach',
} as const;

export type CoachRowKind = (typeof CoachRowKinds)[keyof typeof CoachRowKinds];

/**
 * Every verb on this screen. Accepting and messaging move things forward and
 * take honey; the plumbing verb stays neutral; the two that end something
 * are red and sorted into their own card by the sheet.
 */
export const COACH_ACTIONS: readonly CoachAction[] = [
  {
    id: CoachActionIds.Accept,
    label: 'coaches.actions.accept',
    icon: 'checkmark-circle-outline',
    color: 'primary',
  },
  {
    id: CoachActionIds.Message,
    label: 'coaches.actions.message',
    icon: 'chatbubble-outline',
    color: 'primary',
  },
  {
    id: CoachActionIds.ViewProfile,
    label: 'coaches.actions.viewProfile',
    icon: 'person-outline',
    color: 'medium',
  },
  {
    id: CoachActionIds.Decline,
    label: 'coaches.actions.decline',
    icon: 'close-circle-outline',
    color: 'danger',
    destructive: true,
  },
  {
    id: CoachActionIds.Leave,
    label: 'coaches.actions.leaveEllipsis',
    icon: 'exit-outline',
    color: 'danger',
    destructive: true,
  },
];

/**
 * The verbs for one row. Only what can actually do something: messaging and
 * the public profile need an account and a handle on the other end, and an
 * invitation the reader has not accepted is not someone to message yet.
 *
 * Declining fires on the tap — the coach can invite again — while leaving
 * asks first, because it cuts off something that was working.
 */
export function visibleCoachActions(
  kind: CoachRowKind,
  options: { handle?: string | null; userId?: string | null } = {},
): CoachAction[] {
  return COACH_ACTIONS.filter((action) => {
    switch (action.id) {
      case CoachActionIds.Accept:
      case CoachActionIds.Decline:
        return kind === CoachRowKinds.Invite;
      case CoachActionIds.Leave:
        return kind === CoachRowKinds.Coach;
      case CoachActionIds.Message:
        return kind === CoachRowKinds.Coach && !!options.userId;
      case CoachActionIds.ViewProfile:
        return !!options.handle;
      default:
        return true;
    }
  });
}
