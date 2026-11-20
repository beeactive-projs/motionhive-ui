import { ProgramAssignmentStatus, appLocale, translate } from 'core';

/**
 * What a trainee is told about a plan their coach paused, finished or
 * cancelled (design Trainee, owner 2026-11-20), on the plan's page and on
 * the Workouts tab alike.
 */

/** A plan's state, as the sentence needs it. */
export interface PlanStatusFacts {
  status: string;
  /** ISO instant of the last status change; null when not recorded. */
  statusChangedAt: string | null | undefined;
  /** The coach changed it (not the plan finishing on its own). */
  byCoach: boolean;
  completionPercent: number;
  /** Workouts finished in it. */
  workoutsDone: number;
  /** The coach's first name, or "Your coach" when there is none. */
  coach: string;
}

/** What the card's action does. */
export const PlanStatusActions = {
  /** Write to the coach who paused it. */
  Message: 'message',
  /** Open the history, where the finished workouts stay. */
  History: 'history',
} as const;

export type PlanStatusAction = (typeof PlanStatusActions)[keyof typeof PlanStatusActions];

/** The states a plan card explains; a running or waiting plan says nothing. */
const STOPPED: readonly string[] = [
  ProgramAssignmentStatus.Paused,
  ProgramAssignmentStatus.Cancelled,
  ProgramAssignmentStatus.Completed,
];

/** @Arguments status */
export function isStoppedPlan(status: string): boolean {
  return STOPPED.includes(status);
}

/**
 * "19 Nov", the day a change happened, in the reader's language.
 * @Arguments iso
 */
export function statusDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/**
 * The sentence under a stopped plan: since when it is paused and that its
 * paused days don't count as missed; when it was cancelled and how many
 * workouts stay in the history; who finished it and at what percent. Null
 * for a plan still running.
 * @Arguments facts
 */
export function planStatusLine(facts: PlanStatusFacts): string | null {
  let date: string | null = null;
  if (facts.statusChangedAt) {
    date = statusDayLabel(facts.statusChangedAt);
  }
  const params = {
    coach: facts.coach,
    date,
    count: facts.workoutsDone,
    percent: facts.completionPercent,
  };
  switch (facts.status) {
    case ProgramAssignmentStatus.Paused:
      if (date) {
        return translate('workouts.planStatus.paused.since', params);
      }
      return translate('workouts.planStatus.paused.noDate', params);
    case ProgramAssignmentStatus.Cancelled:
      if (date) {
        return translate('workouts.planStatus.cancelled.line', params);
      }
      return translate('workouts.planStatus.cancelled.lineNoDate', params);
    case ProgramAssignmentStatus.Completed:
      if (!facts.byCoach) {
        return translate('workouts.planStatus.finished.done', params);
      }
      if (date) {
        return translate('workouts.planStatus.finished.byCoach', params);
      }
      return translate('workouts.planStatus.finished.byCoachNoDate', params);
    default:
      return null;
  }
}

/**
 * The card's one action: a paused plan waits on the coach, so it offers
 * to write to them; an ended one points at what was done.
 * @Arguments status
 */
export function planStatusAction(status: string): PlanStatusAction | null {
  if (status === ProgramAssignmentStatus.Paused) {
    return PlanStatusActions.Message;
  }
  if (status === ProgramAssignmentStatus.Cancelled || status === ProgramAssignmentStatus.Completed) {
    return PlanStatusActions.History;
  }
  return null;
}

/**
 * "Message Andrei", or "Message your coach" when they have no first name.
 * @Arguments coachFirstName
 */
export function messageCoachLabel(coachFirstName: string | null): string {
  if (coachFirstName) {
    return translate('workouts.planStatus.messageCoach', { coach: coachFirstName });
  }
  return translate('workouts.planStatus.messageYourCoach');
}

/**
 * The coach's first name, else their last, else null.
 * @Arguments instructor
 */
export function coachFirstName(
  instructor: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null {
  if (!instructor) {
    return null;
  }
  const first = instructor.firstName?.trim();
  if (first) {
    return first;
  }
  const last = instructor.lastName?.trim();
  if (last) {
    return last;
  }
  return null;
}
