import type { AssignedSet } from './assignment.model';
import type { ExerciseKind } from '../exercise/exercise.enums';
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
  /**
   * The routine this session was started from. Null for assigned work
   * (see `assignment`) and for genuinely freestyle sessions — those two
   * used to be indistinguishable because neither stored anything.
   */
  sourceProgram?: { id: string; name: string; isSingleWorkout: boolean } | null;
  sourceProgramId?: string | null;
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
  /**
   * Future export hooks — activity-type codes written when this log is
   * mirrored *out* to Apple Health / Health Connect. Write-only placeholders
   * on the API today (always null); not an "imported from wearable" marker.
   */
  hkActivityType?: string | null;
  healthConnectExerciseType?: string | null;
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
  /** Snapshot of the catalog exercise's name at log time. */
  exerciseNameSnapshot: string;
  /** Snapshot of the catalog exercise's thumbnail at log time. */
  exerciseThumbnailUrlSnapshot: string | null;
  /** Optional grouping with other exercises (e.g. SUPERSET A). */
  supersetGroupId?: number | null;
  notes: string | null;
  /**
   * Explicit skip. Distinct from untouched (present, nothing completed)
   * and from absent (never added). Skipped exercises drop out of the
   * progress denominator but stay visible to the coach.
   */
  isSkipped: boolean;
  /** Set when substituted mid-workout; anchors to the original. */
  swappedFromExerciseId: string | null;
  /** Eager-loaded so a swap can be named, not just flagged. */
  swappedFromExercise?: { id: string; name: string } | null;
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: ExerciseKind;
    level: string;
    thumbnailUrl: string | null;
    /** Split squats, single-arm work: reps read as per-side. */
    isUnilateral?: boolean;
  } | null;
  sets?: LoggedSet[];
}

/** The input columns a set row shows, in display order. */
export type SetField = 'weight' | 'reps' | 'duration' | 'distance';

const FIELDS_BY_KIND: Record<ExerciseKind, SetField[]> = {
  STRENGTH: ['weight', 'reps'],
  BODYWEIGHT: ['reps'],
  DURATION: ['duration'],
  DISTANCE: ['distance', 'duration'],
  CARDIO: ['distance', 'duration'],
  MOBILITY: ['duration'],
};

/**
 * Fields to render for a logged exercise. Falls back to the strength
 * shape when the catalog row is missing, which happens on freestyle
 * logs whose exercise was later deleted.
 */
export function setFieldsFor(kind: string | null | undefined): SetField[] {
  return FIELDS_BY_KIND[(kind ?? 'STRENGTH') as ExerciseKind] ?? FIELDS_BY_KIND.STRENGTH;
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
