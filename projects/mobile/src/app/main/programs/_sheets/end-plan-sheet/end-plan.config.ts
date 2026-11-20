import {
  ProgramAssignment,
  ProgramAssignmentKind,
  ProgramAssignmentStatus,
  TrainingDayPlan,
  localDayKey,
  translate,
} from 'core';

import { planWeekLabel } from '../../../workouts/workouts.config';

/**
 * What a coach can do with a client's plan from its sheet (design EndPlan,
 * owner 2026-11-20): pause it, mark it finished early, or cancel it. Resume
 * is not here: on a paused plan it stays the row's own direct verb.
 */
export const EndPlanChoices = {
  Pause: 'pause',
  Finish: 'finish',
  Cancel: 'cancel',
} as const;

export type EndPlanChoice = (typeof EndPlanChoices)[keyof typeof EndPlanChoices];

/** The status each choice sends. */
const CHOICE_STATUS: Record<EndPlanChoice, ProgramAssignmentStatus> = {
  [EndPlanChoices.Pause]: ProgramAssignmentStatus.Paused,
  [EndPlanChoices.Finish]: ProgramAssignmentStatus.Completed,
  [EndPlanChoices.Cancel]: ProgramAssignmentStatus.Cancelled,
};

/**
 * The choices a plan in this state offers, in the sheet's order. A running
 * or waiting plan can be paused; a paused one only finished or cancelled
 * (resuming is the row's verb); a finished or cancelled one is a record.
 * @Arguments status
 */
export function endPlanChoices(status: ProgramAssignmentStatus): EndPlanChoice[] {
  if (status === ProgramAssignmentStatus.Active || status === ProgramAssignmentStatus.Pending) {
    return [EndPlanChoices.Pause, EndPlanChoices.Finish, EndPlanChoices.Cancel];
  }
  if (status === ProgramAssignmentStatus.Paused) {
    return [EndPlanChoices.Finish, EndPlanChoices.Cancel];
  }
  return [];
}

/**
 * Whether the plan can still be changed from the sheet, so the row shows
 * its ⋯.
 * @Arguments status
 */
export function canChangePlan(status: ProgramAssignmentStatus): boolean {
  return endPlanChoices(status).length > 0;
}

/** @Arguments choice */
export function endPlanStatus(choice: EndPlanChoice): ProgramAssignmentStatus {
  return CHOICE_STATUS[choice];
}

/** Cancelling ends the plan for good, so it is the one red choice. @Arguments choice */
export function isDestructiveChoice(choice: EndPlanChoice): boolean {
  return choice === EndPlanChoices.Cancel;
}

/**
 * Who the sheet talks about: the client's first name, as the design says
 * "Anna's plan" and "Anna gets a notification"; their full name or the
 * generic word when there is no first name.
 * @Arguments row, fallback
 */
export function endPlanClientName(row: ProgramAssignment, fallback: string): string {
  const first = row.client?.firstName?.trim();
  if (first) {
    return first;
  }
  const last = row.client?.lastName?.trim();
  if (last) {
    return last;
  }
  return fallback;
}

/**
 * "Week 3 of 8" (or "Starts Mon 23 Nov") for an assignment row, the same
 * label the trainee's Workouts tab gives the plan.
 * @Arguments row, now
 */
export function assignmentWeekLabel(row: ProgramAssignment, now: Date): string {
  let kind: string = ProgramAssignmentKind.Coach;
  if (row.assignmentKind) {
    kind = row.assignmentKind;
  }
  const plan: TrainingDayPlan = {
    id: row.id,
    programNameSnapshot: row.programNameSnapshot,
    status: row.status,
    completionPercent: row.completionPercent,
    startDate: row.startDate,
    endDate: row.endDate,
    assignmentKind: kind,
    instructor: null,
  };
  return planWeekLabel(plan, localDayKey(now));
}

/**
 * "Strength Base · Week 3 of 8 · 42% done", the line under the sheet's
 * title: which plan, where the client is in it, and how much is done.
 * @Arguments row, now
 */
export function endPlanSubtitle(row: ProgramAssignment, now: Date): string {
  const week = assignmentWeekLabel(row, now);
  const done = translate('programs.assignment.percentDone', { percent: row.completionPercent });
  return [row.programNameSnapshot, week, done].join(' · ');
}
