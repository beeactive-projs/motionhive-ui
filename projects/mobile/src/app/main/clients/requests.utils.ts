import { InstructorClient, isIncomingRequest, isSentInvite, startOfDay } from 'core';

/** The Requests page's own helpers: who is waiting on whom, and since when. */

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
