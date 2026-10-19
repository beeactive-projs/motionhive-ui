import { RosterClient, RosterWindow, translate } from 'core';

/**
 * Plain language over the coach's roster — what the API says in numbers,
 * said the way a coach reads it. Pure, and read by the client detail card.
 * Every label goes through `translate()` when called, so these are safe to
 * use anywhere after bootstrap.
 */

/** The detail card reads "this week" — the roster's shorter window. */
export const ROSTER_WINDOW: RosterWindow = '1w';

/** Null adherence means nothing was due, which is not the same as 0%. */
export function adherenceLabel(client: RosterClient): string {
  return client.adherencePercent == null ? '—' : `${client.adherencePercent}%`;
}

/** The sentence form for the detail card. Null when unknown. */
export function lastActiveLabel(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  if (days === 0) return translate('clients.roster.lastActive.today');
  if (days === 1) return translate('clients.roster.lastActive.yesterday');
  return translate('clients.roster.lastActive.daysAgo', { count: days });
}
