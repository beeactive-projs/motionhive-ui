import type { WorkoutLogStatus } from './workout.enums';

/**
 * The Workouts front door read. One call so the surface doesn't have to
 * list assignments and then fetch each tree looking for today.
 *
 * Scoped to coach-assigned and self-scheduled plans. Routines and any
 * in-progress log come from their own endpoints.
 */
export interface TrainingDay {
  /** Null on a rest day, which is a real answer rather than an error. */
  today: TrainingDayWorkout | null;
  /** Monday to Sunday around the requested date, oldest first. */
  week: TrainingDayWorkout[];
  activePlans: TrainingDayPlan[];
}

export interface TrainingDayWorkout {
  assignedWorkoutId: string;
  programAssignmentId: string;
  name: string;
  /** ISO date, YYYY-MM-DD. */
  scheduledDate: string | null;
  status: WorkoutLogStatus | null;
  weekIndex: number;
  dayIndex: number;
  estimatedDurationMinutes: number | null;
  /** Denormalised so a card renders without a second lookup. */
  planName: string | null;
  instructor: TrainingDayInstructor | null;
}

export interface TrainingDayPlan {
  id: string;
  programNameSnapshot: string;
  status: string;
  completionPercent: number;
  startDate: string;
  endDate: string | null;
  /** COACH when an instructor assigned it, SELF when self-scheduled. */
  assignmentKind: string;
  instructor: TrainingDayInstructor | null;
}

export interface TrainingDayInstructor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  handle: string | null;
}

/** Body for scheduling one of your own routines across the week. */
export interface ScheduleRoutinePayload {
  programId: string;
  /** ISO 8601 weekdays: 1 = Monday through 7 = Sunday. */
  daysOfWeek: number[];
  /** WEEKLY rolls on; BLOCK runs for `repeatWeeks` then completes. */
  repeatMode?: 'WEEKLY' | 'BLOCK';
  repeatWeeks?: number;
  /** Defaults to today. */
  startDate?: string;
}
