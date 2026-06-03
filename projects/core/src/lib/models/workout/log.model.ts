import type { AssignedSet } from './assignment.model';
import type {
  ExerciseSetType,
  WorkoutLogStatus,
} from './workout.enums';

/**
 * One client workout-log session. Either tied to an assigned workout
 * (the common case — `assignedWorkoutId` set) or freestyle. The deep
 * tree below is hydrated on `start` from the assignment snapshot.
 */
export interface WorkoutLog {
  id: string;
  userId: string;
  programAssignmentId: string | null;
  assignedWorkoutId: string | null;
  name: string;
  status: WorkoutLogStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  feelingRating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  exercises?: LoggedExercise[];
  /**
   * Lightweight reference to the source assignment when the log
   * belongs to one (history list eager-loads this). Null for freestyle.
   */
  assignment?: {
    id: string;
    programNameSnapshot: string;
    masterProgramId: string | null;
  } | null;
  /**
   * 1RM personal records broken in this session (Epley-estimated from
   * loaded sets). Present on the detail endpoint after the workout is
   * completed; absent otherwise.
   */
  personalRecords?: PersonalRecord[];
  /** History list only — count of session PRs, for the badge. */
  prCount?: number;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  /** New 1RM in kg. */
  weightKg: number;
  /** Improvement over prior best; equals `weightKg` for first-ever PRs. */
  deltaKg: number;
}

export interface LoggedExercise {
  id: string;
  workoutLogId: string;
  exerciseId: string | null;
  assignedExerciseId: string | null;
  orderIndex: number;
  notes: string | null;
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    level: string;
    thumbnailUrl: string | null;
  } | null;
  sets?: LoggedSet[];
}

export interface LoggedSet {
  id: string;
  loggedExerciseId: string;
  assignedSetId: string | null;
  orderIndex: number;
  setType: ExerciseSetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  rir: number | null;
  restAfterSeconds: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
  /**
   * Linked prescription — present on assigned-workout logs, null for
   * freestyle sets. Use this to render the target column.
   */
  assignedSet?: AssignedSet | null;
}

// ─── Payloads ────────────────────────────────────────────────────────

export interface StartWorkoutPayload {
  /** Set for an assigned workout; omit for freestyle (then `name` is required). */
  assignedWorkoutId?: string;
  /** Only used for freestyle workouts. */
  name?: string;
}

export interface LogSetPayload {
  setType?: ExerciseSetType;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
  rir?: number;
  restAfterSeconds?: number;
  isCompleted?: boolean;
  notes?: string;
}

export interface CompleteWorkoutPayload {
  /** 1–5. */
  feelingRating?: number;
  notes?: string;
}
