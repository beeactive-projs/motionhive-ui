import { ProgramAssignment, ProgramAssignmentStatus, appLocale, translate } from 'core';

/**
 * What the plan page says about a plan its coach paused, finished or
 * cancelled (owner, 2026-11-20): since when, who, what happens to the
 * days, and the coach's own words. The same rules as the mobile app.
 */

/**
 * A plan whose days can be started: running, or waiting for its start.
 * Paused, cancelled and finished plans only show their days; the API
 * refuses to start one (`workout.planNotActive`).
 * @Arguments status
 */
export function canStartIn(status: ProgramAssignmentStatus | null | undefined): boolean {
  return status === ProgramAssignmentStatus.Active || status === ProgramAssignmentStatus.Pending;
}

/** The coach made the last change, rather than the plan finishing on its own. @Arguments plan */
export function changedByCoach(plan: ProgramAssignment): boolean {
  if (!plan.statusChangedBy) {
    return false;
  }
  return plan.statusChangedBy === plan.instructorId;
}

/** "19 Nov" in the reader's language. @Arguments iso */
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' });
}

/**
 * The sentence under a stopped plan's status, or null when the page keeps
 * its general message (a plan running, or a change with no recorded date).
 * @Arguments plan, coach (the coach's name, or "Your coach"), workoutsDone
 */
export function planStatusDetail(
  plan: ProgramAssignment,
  coach: string,
  workoutsDone: number,
): string | null {
  if (!plan.statusChangedAt) {
    return null;
  }
  const date = dayLabel(plan.statusChangedAt);
  switch (plan.status) {
    case ProgramAssignmentStatus.Paused:
      return translate('training.planDetail.status.paused.since', { date, coach });
    case ProgramAssignmentStatus.Cancelled:
      return translate('training.planDetail.status.cancelled.since', {
        date,
        coach,
        count: workoutsDone,
      });
    case ProgramAssignmentStatus.Completed:
      if (!changedByCoach(plan)) {
        return null;
      }
      return translate('training.planDetail.status.completed.byCoach', {
        date,
        coach,
        percent: plan.completionPercent,
      });
    default:
      return null;
  }
}

/**
 * The coach's words with the change, as written; only for a change they
 * made, and only while the plan is stopped.
 * @Arguments plan
 */
export function planStatusMessage(plan: ProgramAssignment): string | null {
  if (canStartIn(plan.status) || !changedByCoach(plan)) {
    return null;
  }
  const message = plan.statusMessage?.trim();
  if (!message) {
    return null;
  }
  return message;
}
