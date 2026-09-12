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
  repeatOutline,
  trashOutline,
} from 'ionicons/icons';

import { Program, ProgramAssignmentStatus } from 'core';

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
