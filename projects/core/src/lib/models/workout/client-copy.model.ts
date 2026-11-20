import type { AssignedSet } from './assignment.model';
import type { PrescribedExercise } from './program.model';
import type { ExerciseSetType, ProgramAssignmentStatus, WorkoutLogStatus } from './workout.enums';

/**
 * A coach editing one client's copy of a plan (`/program-assignments/:id/copy`,
 * owner 2026-11-20). The copy is the client's own; nothing done to it reaches
 * the program or its other clients.
 */

/**
 * Why a day of the copy can't change: the plan stopped running, the day is
 * done or skipped, the client started it, or its date has passed. A day with
 * no lock can change.
 */
export const CopyDayLock = {
  PlanClosed: 'PLAN_CLOSED',
  Done: 'DONE',
  Skipped: 'SKIPPED',
  Started: 'STARTED',
  Past: 'PAST',
} as const;
export type CopyDayLock = (typeof CopyDayLock)[keyof typeof CopyDayLock];

/** How an exercise of the copy differs from the program. */
export const CopyExerciseChange = {
  None: 'NONE',
  /** Its sets, rest or note were changed for this client. */
  Changed: 'CHANGED',
  /** Its movement is not the one its program row names. */
  Replaced: 'REPLACED',
  /** Added for this client; no program row behind it. */
  Added: 'ADDED',
} as const;
export type CopyExerciseChange = (typeof CopyExerciseChange)[keyof typeof CopyExerciseChange];

/** The client, as the copy's header names them. */
export interface CopyClient {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  handle: string | null;
}

/** The plan a copy belongs to. */
export interface CopyPlanSummary {
  id: string;
  status: ProgramAssignmentStatus;
  programNameSnapshot: string;
  masterProgramId: string | null;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  endDate: string | null;
  completionPercent: number;
  clientId: string;
  client: CopyClient | null;
}

/** One day of the copy, and whether the coach may change it. */
export interface CopyDaySummary {
  id: string;
  name: string;
  notes: string | null;
  weekIndex: number;
  dayIndex: number;
  /** ISO date (YYYY-MM-DD). */
  scheduledDate: string | null;
  status: WorkoutLogStatus | null;
  lock: CopyDayLock | null;
  editable: boolean;
  /** The coach changed this day of the copy at some point. */
  changed: boolean;
}

/** `GET /program-assignments/:id/copy`: every day, in date order. */
export interface CopyOverview {
  assignment: CopyPlanSummary;
  /** The server's date, which decides what has passed. */
  today: string;
  days: (CopyDaySummary & { exerciseCount: number })[];
}

/** A set as the program holds it now, with its planned rest filled in. */
export interface CopyProgramSet {
  orderIndex: number;
  setType: ExerciseSetType;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetWeightPercent1rm: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetRpe: number | null;
  targetRir: number | null;
  restAfterSeconds: number | null;
  tempo: string | null;
  notes: string | null;
}

/** An exercise's program row as it is now: what "back to the program" restores. */
export interface CopyProgramValues {
  exerciseId: string;
  exercise: PrescribedExercise['exercise'] | null;
  notes: string | null;
  sets: CopyProgramSet[];
}

/** One completed working set of the client's last time on a movement. */
export interface CopyLastSet {
  setType: ExerciseSetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
}

/** The client's last finished session of a movement that the coach may read. */
export interface CopyLastResult {
  workoutLogId: string;
  /** ISO instant. */
  performedAt: string;
  sets: CopyLastSet[];
  /** The effort they logged, averaged; null when they logged none. */
  averageRpe: number | null;
}

/** One exercise of a day of the copy. */
export interface CopyExercise {
  id: string;
  exerciseId: string;
  masterExerciseId: string | null;
  supersetGroupId: number | null;
  orderIndex: number;
  notes: string | null;
  isModifiedFromMaster: boolean;
  exercise: PrescribedExercise['exercise'] | null;
  sets: AssignedSet[];
  change: CopyExerciseChange;
  /** "Back to the program's values" applies. */
  canRevert: boolean;
  /** Its program row as it is now; null when added here or that row is gone. */
  program: CopyProgramValues | null;
  lastResult: CopyLastResult | null;
}

/** Where a day may move: first and last date, and the dates other days hold. */
export interface CopyMoveBounds {
  from: string;
  to: string | null;
  taken: string[];
}

/** `GET /program-assignments/:id/copy/days/:dayId`. */
export interface CopyDayDetail {
  assignment: CopyPlanSummary;
  today: string;
  move: CopyMoveBounds;
  day: CopyDaySummary & { exercises: CopyExercise[] };
}

/** What Done answers: whether the client was told, about how many days. */
export interface CopyDoneResult {
  notified: boolean;
  days: number;
}

/** Body for swapping an exercise of the copy or changing its note. */
export interface UpdateCopyExercisePayload {
  exerciseId?: string;
  notes?: string | null;
}
