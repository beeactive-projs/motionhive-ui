import { RosterAttention, RosterClient, RosterWindow, translate } from 'core';

/**
 * Plain language over the coach's roster — what the API says in enums and
 * percentages, said the way a coach reads it. Pure, and shared by the triage
 * rows, the on-track rows and the client detail card. Every label goes
 * through `translate()` when called, so these are safe to use anywhere after
 * bootstrap.
 */

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
      return translate('clients.roster.attention.noPlan');
    case 'NEVER_STARTED':
      return translate('clients.roster.attention.neverStarted');
    case 'SILENT':
      return translate('clients.roster.attention.inactive', {
        count: client.daysSinceLastWorkout,
      });
    case 'DROPPED':
      return translate('clients.roster.attention.dropped');
    case 'BEHIND':
      return translate('clients.roster.attention.behind');
    default:
      return '';
  }
}

/** One line saying what actually happened, for the screens with room for it. */
export function attentionDetail(client: RosterClient): string {
  switch (client.attention) {
    case 'NO_PLAN':
      return translate('clients.roster.detail.noPlan');
    case 'NEVER_STARTED':
      return translate('clients.roster.detail.neverStarted');
    case 'SILENT':
      return client.due > 0
        ? translate('clients.roster.detail.silent', {
            completed: client.completed,
            due: client.due,
          })
        : translate('clients.roster.detail.silentNone');
    case 'DROPPED':
      return translate('clients.roster.detail.dropped', {
        previous: client.previousAdherencePercent,
        current: client.adherencePercent,
      });
    case 'BEHIND':
      return translate('clients.roster.detail.behind', {
        completed: client.completed,
        due: client.due,
      });
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
    return client.activePlans === 0
      ? translate('clients.roster.noActivePlan')
      : translate('clients.roster.nothingScheduled');
  }
  return translate('clients.roster.progress', { completed: client.completed, due: client.due });
}

/** "today" / "3d ago" — the stat sub-line on a list row. Null when unknown. */
export function lastActiveShort(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  return days === 0
    ? translate('clients.roster.lastActiveShort.today')
    : translate('clients.roster.lastActiveShort.daysAgo', { count: days });
}

/** The sentence form for the detail card. Null when unknown. */
export function lastActiveLabel(client: RosterClient): string | null {
  const days = client.daysSinceLastWorkout;
  if (days === null) return null;
  if (days === 0) return translate('clients.roster.lastActive.today');
  if (days === 1) return translate('clients.roster.lastActive.yesterday');
  return translate('clients.roster.lastActive.daysAgo', { count: days });
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
    return { value: '—', sub: translate('clients.roster.stat.noPlan') };
  }
  if (client.attention === 'SILENT' && client.daysSinceLastWorkout !== null) {
    return {
      value: translate('clients.roster.stat.days', { count: client.daysSinceLastWorkout }),
      sub: translate('clients.roster.stat.lastActive'),
    };
  }
  return { value: adherenceLabel(client), sub: translate('clients.roster.stat.adherence') };
}

/** An on-track row: adherence, with when they last trained under it. */
export function onTrackStat(client: RosterClient): ClientStat {
  return {
    value: adherenceLabel(client),
    sub: lastActiveShort(client) ?? translate('clients.roster.stat.adherence'),
  };
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
  return translate('clients.triage.note', { needs, total });
}
