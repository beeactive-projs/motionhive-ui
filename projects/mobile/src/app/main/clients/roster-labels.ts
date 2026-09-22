import { RosterAttention, RosterClient, RosterWindow } from 'core';

/**
 * Plain language over the coach's roster — what the API says in enums and
 * percentages, said the way a coach reads it. Pure, and shared by the triage
 * rows, the on-track rows and the client detail card.
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
