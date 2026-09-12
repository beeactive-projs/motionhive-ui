import {
  addOutline,
  albumsOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForward,
  closeOutline,
  copyOutline,
  ellipsisHorizontal,
  flashOutline,
  peopleOutline,
  personAddOutline,
  playOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
} from 'ionicons/icons';

import { Program, ProgramAssignmentStatus, RosterAttention } from 'core';

import { workoutDuration } from '../workouts/workouts.config';

/**
 * Every icon these screens render. An unregistered name draws a blank box
 * with no error, so `programs.config.spec.ts` asserts this covers both the
 * templates and the names assembled in TypeScript.
 */
export const PROGRAM_ICONS = {
  addOutline,
  albumsOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForward,
  closeOutline,
  copyOutline,
  ellipsisHorizontal,
  flashOutline,
  peopleOutline,
  personAddOutline,
  playOutline,
  removeOutline,
  repeatOutline,
  trashOutline,
};

/** Days per week, for turning a stored `durationDays` back into weeks. */
const DAYS_PER_WEEK = 7;

/**
 * The library's spine tones. The distinction this carries is *what kind of
 * thing* a row is — a multi-week program or a single routine — with an
 * unpublished one dimmed, because a draft cannot be assigned yet.
 */
export function programTone(program: Program): string {
  if (program.status === 'DRAFT') return 'muted';
  return program.isSingleWorkout ? 'teal' : 'honey';
}

/** "12 weeks · 3 days/week" for a program; "6 exercises" for a routine. */
export function programMeta(program: Program, exerciseCount?: number): string {
  if (program.isSingleWorkout) {
    const n = exerciseCount ?? 0;
    // Silent when the count is unknown: the row already wears a Routine
    // badge, and saying it twice tells you nothing the second time.
    return n ? `${n} ${n === 1 ? 'exercise' : 'exercises'}` : '';
  }
  const weeks = weeksOf(program);
  const days = (program.workouts ?? []).length;
  const parts: string[] = [];
  if (weeks) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  if (weeks && days) parts.push(`${Math.round(days / weeks)} days/week`);
  return parts.join(' · ');
}

/** Whole weeks a program runs for. Null duration means open-ended. */
export function weeksOf(program: Program): number | null {
  return program.durationDays ? Math.ceil(program.durationDays / DAYS_PER_WEEK) : null;
}

export function weeksToDays(weeks: number): number {
  return weeks * DAYS_PER_WEEK;
}

/**
 * Assignment states, as the rows say them.
 *
 * ACTIVE is deliberately silent: it is the state almost every row is in, and
 * a chip on every row is a chip that says nothing. Only the exceptions speak.
 */
const ASSIGNMENT_CHIPS: Record<string, { label: string; tone: string } | null> = {
  ACTIVE: null,
  PENDING: { label: 'Not started', tone: 'honey' },
  PAUSED: { label: 'Paused', tone: 'muted' },
  COMPLETED: { label: 'Completed', tone: 'teal' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export function assignmentChip(
  status: ProgramAssignmentStatus | string,
): { label: string; tone: string } | null {
  return ASSIGNMENT_CHIPS[status] ?? null;
}

export function assignmentTone(status: ProgramAssignmentStatus | string): string {
  switch (status) {
    case 'PENDING':
      return 'honey';
    case 'ACTIVE':
      return 'success';
    case 'PAUSED':
      return 'muted';
    case 'COMPLETED':
      return 'teal';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'muted';
  }
}

/**
 * Which calendar date a given week/day of a program lands on, counting from
 * the assignment's start. This is what the assign sheet previews — a start
 * date on the wrong weekday is the mistake that otherwise surfaces days later
 * in a message from the client.
 */
export function scheduledDateFor(
  startDate: string,
  weekIndex: number,
  dayIndex: number,
): Date {
  // Parsed as local midnight: a date-only string is a calendar day, and
  // `new Date('2026-09-01')` reads it as UTC, slipping a day west of Greenwich.
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() + weekIndex * DAYS_PER_WEEK + dayIndex);
  return start;
}

/**
 * Why a client needs attention, and what to do about it.
 *
 * One reason per row, and every row ends in an action — a roster that only
 * diagnoses leaves the coach to work out the next move for each person,
 * which is the work it was supposed to save.
 */
const ATTENTION: Record<
  string,
  { label: string; tone: string; action: string }
> = {
  NEVER_STARTED: {
    label: 'Never started',
    tone: 'danger',
    action: 'Nudge',
  },
  DROPPED: {
    label: 'Falling off',
    tone: 'coral',
    action: 'Check in',
  },
  BEHIND: {
    label: 'Behind',
    tone: 'warning',
    action: 'Check in',
  },
  SILENT: {
    label: 'Gone quiet',
    tone: 'info',
    action: 'Message',
  },
};

export function attentionLabel(reason: RosterAttention): string {
  return reason ? (ATTENTION[reason]?.label ?? '') : '';
}

export function attentionTone(reason: RosterAttention): string {
  return reason ? (ATTENTION[reason]?.tone ?? 'muted') : 'muted';
}

export function attentionAction(reason: RosterAttention): string {
  return reason ? (ATTENTION[reason]?.action ?? 'Open') : 'Open';
}

/**
 * Adherence as a row says it. Null means nothing was due in the window —
 * which is an absence, not a zero, and printing "0%" would accuse someone of
 * missing work that was never set.
 */
export function adherenceLabel(percent: number | null): string {
  return percent === null ? 'Nothing due' : `${percent}% adherence`;
}

/**
 * A logged workout's length, reusing the workouts feature's formatter so a
 * duration reads the same wherever it appears.
 */
export const workoutDurationOf = workoutDuration;
