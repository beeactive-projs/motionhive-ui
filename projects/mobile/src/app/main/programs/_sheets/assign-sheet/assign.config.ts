import { ProgramAssignment, ProgramAssignmentStatus, appLocale, translate } from 'core';

import { assignmentWeekLabel } from '../end-plan-sheet/end-plan.config';

/**
 * The assign sheet's previews (design Assign, owner 2026-11-20): the first
 * week's days against real dates, the plan's last day, and a warning when
 * the client already follows another of this coach's plans.
 */

/** One day of the plan as the preview places it. */
export interface PreviewDay {
  name: string;
  /** The program's own week, 0-based. */
  weekIndex: number;
  date: Date;
}

/**
 * The days of the plan's first week, in the order they happen: what the
 * client will see first, and where a wrong start date shows at once.
 * @Arguments days
 */
export function firstWeekOf(days: readonly PreviewDay[]): PreviewDay[] {
  if (!days.length) {
    return [];
  }
  let first = days[0].weekIndex;
  for (const day of days) {
    if (day.weekIndex < first) {
      first = day.weekIndex;
    }
  }
  return days
    .filter((day) => day.weekIndex === first)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * The plan's last training day, or null with nothing scheduled.
 * @Arguments days
 */
export function lastDayOf(days: readonly PreviewDay[]): Date | null {
  let last: Date | null = null;
  for (const day of days) {
    if (!last || day.date.getTime() > last.getTime()) {
      last = day.date;
    }
  }
  return last;
}

/** "Fri, 15 Jan 2027", the plan's last day in the reader's language. @Arguments date */
export function lastDayLabel(date: Date): string {
  return date.toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The plans of this coach's a client is on now: running or waiting to
 * start. A paused, finished or cancelled one does not run alongside.
 * @Arguments rows
 */
export function runningPlansOf(rows: readonly ProgramAssignment[]): ProgramAssignment[] {
  return rows.filter(
    (row) =>
      row.status === ProgramAssignmentStatus.Active ||
      row.status === ProgramAssignmentStatus.Pending,
  );
}

/** "week 3 of 6": the week label, lower case to sit inside a sentence. */
function weekInSentence(row: ProgramAssignment, now: Date): string {
  const label = assignmentWeekLabel(row, now);
  return label.charAt(0).toLocaleLowerCase(appLocale()) + label.slice(1);
}

/**
 * "Elena already follows Return to running (week 3 of 6). They'll have both
 * at the same time." Null when the client follows nothing else.
 * @Arguments name, running, now
 */
export function otherPlanNote(
  name: string,
  running: readonly ProgramAssignment[],
  now: Date,
): string | null {
  if (!running.length) {
    return null;
  }
  if (running.length === 1) {
    const plan = running[0];
    return translate('programs.assign.otherPlan', {
      name,
      program: plan.programNameSnapshot,
      week: weekInSentence(plan, now),
    });
  }
  return translate('programs.assign.otherPlans', { name, count: running.length });
}
