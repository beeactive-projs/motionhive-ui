import { RosterClient, RosterWindow, TranslateParams, translate } from 'core';

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

/**
 * Why the roster flagged a client, as a title and an optional line under
 * it. Null when it did not, or for a reason the card does not show.
 */
export function attentionReason(
  client: RosterClient,
): { title: string; detail: string | null } | null {
  const t = (key: string, params?: TranslateParams) =>
    translate(`clients.detail.attention.${key}`, params);
  switch (client.attention) {
    case 'DROPPED':
      return {
        title: t('reason.dropped'),
        detail: t('detail.dropped', {
          previous: Math.round(client.previousAdherencePercent ?? 0),
          current: Math.round(client.adherencePercent ?? 0),
        }),
      };
    case 'BEHIND':
      return { title: t('reason.behind'), detail: null };
    case 'NEVER_STARTED':
      return { title: t('reason.neverStarted'), detail: t('detail.neverStarted') };
    case 'SILENT':
      return {
        title: t('reason.silent', { days: client.daysSinceLastWorkout ?? 14 }),
        detail: null,
      };
    default:
      return null;
  }
}

/** The sentence form for the detail card. Null when unknown. */
export function lastActiveLabel(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  if (days === 0) return translate('clients.roster.lastActive.today');
  if (days === 1) return translate('clients.roster.lastActive.yesterday');
  return translate('clients.roster.lastActive.daysAgo', { count: days });
}
