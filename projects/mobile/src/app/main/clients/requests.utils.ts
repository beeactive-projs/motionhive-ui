import { InstructorClient, translate } from 'core';

import { daysBetween } from '../../_shared/utils/dates';

/**
 * The request sheet's own helpers: since when a request has been waiting.
 *
 * The day arithmetic itself is shared (`_shared/utils/dates`) — the trainee's
 * coaches page counts the same days about the same requests from the other
 * side, and the two must not drift.
 */

/** "Received today" / "Received yesterday" / "Received 3 days ago". */
export function receivedLabel(iso: string, now: number): string {
  const days = daysBetween(iso, now);
  if (days <= 0) return translate('clients.requests.received.today');
  if (days === 1) return translate('clients.requests.received.yesterday');
  return translate('clients.requests.received.daysAgo', { count: days });
}

/**
 * "Sent 3 days ago · expires in 11 days" — how long they have had it, and
 * how long it still stands. The API drops expired rows, so the expiry never
 * reads in the past.
 */
export function sentMetaLabel(row: InstructorClient, now: number): string {
  const sentDays = daysBetween(row.createdAt, now);
  const sent =
    sentDays <= 0
      ? translate('clients.requests.sent.today')
      : sentDays === 1
        ? translate('clients.requests.sent.yesterday')
        : translate('clients.requests.sent.daysAgo', { count: sentDays });
  if (!row.expiresAt) return sent;

  const left = -daysBetween(row.expiresAt, now);
  const expires =
    left <= 0
      ? translate('clients.requests.expires.today')
      : left === 1
        ? translate('clients.requests.expires.tomorrow')
        : translate('clients.requests.expires.inDays', { count: left });
  return translate('clients.requests.sentMeta', { sent, expires });
}
