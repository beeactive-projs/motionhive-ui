import type {
  ExerciseSetType,
  ProgramAssignmentStatus,
  WorkoutLogStatus,
} from './workout.enums';

/**
 * A client's deep-copy assignment of a program. Created server-side
 * via copy-on-assign (locked decision §10). The assigned tree
 * (assigned_workout → assigned_exercise → assigned_set) is the
 * client's authoritative copy.
 */
export interface ProgramAssignment {
  id: string;
  instructorId: string;
  clientId: string;
  instructorClientId: string | null;
  masterProgramId: string | null;
  programNameSnapshot: string;
  status: ProgramAssignmentStatus;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  /** ISO date or null when the program has no fixed duration. */
  endDate: string | null;
  completionPercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Eager-loaded references
  instructor?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  /**
   * Deep-copied tree. Present on the detail endpoint; absent from
   * list responses (kept lean for performance).
   */
  workouts?: AssignedWorkout[];
}

// ─── Deep-copy tree (per-client snapshot) ────────────────────────────

/**
 * One workout day inside the assignment — a deep copy of the
 * `program_workout` row at the time of assignment. Carries its own
 * scheduledDate so the client knows when to do it.
 */
export interface AssignedWorkout {
  id: string;
  programAssignmentId: string;
  masterWorkoutId: string | null;
  sequenceNumber: number;
  /** ISO date (YYYY-MM-DD) when this workout is supposed to happen. */
  scheduledDate: string;
  /** Mirror of program_workout fields snapshot at booking. */
  name: string;
  notes: string | null;
  weekIndex: number;
  dayIndex: number;
  phase: string | null;
  estimatedDurationMinutes: number | null;
  status: WorkoutLogStatus | null;
  exercises?: AssignedExercise[];
}

export interface AssignedExercise {
  id: string;
  assignedWorkoutId: string;
  masterPrescribedExerciseId: string | null;
  exerciseId: string;
  orderIndex: number;
  supersetGroupId: number | null;
  notes: string | null;
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    level: string;
    thumbnailUrl: string | null;
  };
  sets?: AssignedSet[];
}

export interface AssignedSet {
  id: string;
  assignedExerciseId: string;
  masterSetId: string | null;
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

// ─── Query / payload shapes ──────────────────────────────────────────

export interface ListAssignmentsQuery {
  page?: number;
  limit?: number;
  status?: ProgramAssignmentStatus;
  /** Instructor-side only — narrows to one client. */
  clientId?: string;
}

export interface PaginatedAssignments {
  items: ProgramAssignment[];
  total: number;
  page: number;
  pageSize: number;
}

/** Body for `POST /program-assignments`. Triggers the deep-copy tx. */
export interface AssignProgramPayload {
  programId: string;
  clientId: string;
  /** ISO date — day 0 of the program lands here. */
  startDate: string;
  notes?: string;
}

/** Body for `PATCH /program-assignments/:id`. Instructor-only. */
export interface UpdateAssignmentPayload {
  status?: ProgramAssignmentStatus;
  notes?: string;
}
