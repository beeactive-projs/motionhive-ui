import {
  MessageAttachment,
  ShareCard,
  ShareCardState,
  ShareRef,
  ShareResult,
  ShareTargetType,
} from 'core';

import { groupBase, personBase, sharedPagesBase, stackRootOf } from '../utils/stack-paths';

/**
 * Share cards (things sent into a chat) and sending them. Only public things
 * travel: an open session, a public group, a coach in the directory, a
 * public exercise, a MotionHive starter. The card is drawn by the API from
 * the live row, in the reader's language (API migration 092).
 */

/** The tile and the strip of each kind, by the colour rules of `lists.md`. */
export const SHARE_STYLES: Record<ShareTargetType, { icon: string; color: string }> = {
  SESSION: { icon: 'calendar-outline', color: 'info' },
  GROUP: { icon: 'people-outline', color: 'violet' },
  COACH: { icon: 'person-outline', color: 'violet' },
  EXERCISE: { icon: 'barbell-outline', color: 'primary' },
  PROGRAM: { icon: 'list-outline', color: 'primary' },
};

/** The action row's words: "View session", "View routine", ... */
export function shareActionKey(card: ShareCard): string {
  if (card.type === 'PROGRAM' && card.state === ShareCardState.Available) {
    if (card.isSingleWorkout) {
      return 'share.view.ROUTINE';
    }
    return 'share.view.PROGRAM';
  }
  return `share.view.${card.type}`;
}

/**
 * Where a card opens: always in the stack the chat is in, so back returns
 * to the conversation. Sessions, exercises and starters under the chat's
 * `shared/`, a group's preview and a coach's profile where that stack
 * mounts them. Null when there is nothing to open: gone, private, or a
 * coach with no handle yet. An ended session still opens, its page says so.
 */
export function shareLink(attachment: MessageAttachment, url: string): string[] | null {
  const { card, id } = attachment;
  if (card.state === ShareCardState.Unavailable) {
    return null;
  }
  const root = stackRootOf(url);
  const shared = sharedPagesBase(root);
  switch (card.type) {
    case 'SESSION':
      return [shared, 'session', id];
    case 'GROUP':
      return [groupBase(root), 'preview', id];
    case 'COACH':
      if (!card.handle) {
        return null;
      }
      return [personBase(root), card.handle];
    case 'EXERCISE':
      return [shared, 'exercise', id];
    case 'PROGRAM':
      return [shared, 'routine', id];
  }
  return null;
}

/** A session's date tile and start time, in its own time zone and the reader's language. */
export interface SessionDateParts {
  weekday: string;
  day: string;
  month: string;
  time: string;
}

export function sessionDateParts(
  startAt: string,
  timeZone: string,
  locale: string,
): SessionDateParts {
  const date = new Date(startAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
  return {
    weekday: part({ weekday: 'short' }).replace('.', ''),
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }).replace('.', ''),
    time: part({ hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** What a page sends: the thing, and its name for the sheet's subtitle. */
export interface SendTarget {
  ref: ShareRef;
  title: string;
}

/** How many people one send reaches at most (the API's cap). */
export const SEND_LIMIT = 10;

/**
 * Pick or unpick someone. Past the limit nothing changes; the sheet says
 * why. Returns a new map, so a signal holding it moves.
 */
export function toggleRecipient<T extends { id: string }>(
  selected: ReadonlyMap<string, T>,
  person: T,
  limit = SEND_LIMIT,
): ReadonlyMap<string, T> {
  const next = new Map(selected);
  if (next.has(person.id)) {
    next.delete(person.id);
    return next;
  }
  if (next.size >= limit) {
    return selected;
  }
  next.set(person.id, person);
  return next;
}

/** The toast after a send: everyone, some, or nobody reached. */
export function shareSummary(
  results: readonly ShareResult[],
): { key: string; params: Record<string, number>; ok: boolean } {
  const reached = results.filter((r) => r.status !== 'REFUSED').length;
  const refused = results.length - reached;
  if (reached === 0) {
    return { key: 'share.toast.none', params: {}, ok: false };
  }
  if (refused === 0) {
    return { key: 'share.toast.sent', params: { count: reached }, ok: true };
  }
  return { key: 'share.toast.partial', params: { count: reached, refused }, ok: true };
}
