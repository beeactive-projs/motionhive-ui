/**
 * User-authored saved workout shape — name + ordered list of exercises with
 * default sets / reps / weight / rest. Tap "Start" to materialise a fresh
 * `WorkoutLog` with no `programAssignmentId` and the tree pre-seeded.
 *
 * Mirrors `motionhive-api/src/modules/routine/entities/`.
 */
export interface Routine {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  folder: string | null;
  /** Bumped on every successful start; sorts the FE list. */
  lastPerformedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  exercises?: RoutineExercise[];
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  orderIndex: number;
  supersetGroupId: number | null;
  notes: string | null;
  defaultSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restAfterSeconds: number | null;
  /** Eager-loaded on detail/list responses. */
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    thumbnailUrl: string | null;
  };
}

// ─── Payloads ────────────────────────────────────────────────────────

export interface CreateRoutineExercisePayload {
  exerciseId: string;
  supersetGroupId?: number;
  notes?: string;
  defaultSets?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetWeightKg?: number;
  restAfterSeconds?: number;
}

export interface CreateRoutinePayload {
  name: string;
  notes?: string;
  folder?: string;
  exercises?: CreateRoutineExercisePayload[];
}

export type UpdateRoutinePayload = Partial<CreateRoutinePayload>;

export interface ListRoutinesQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedRoutines {
  items: Routine[];
  total: number;
  page: number;
  pageSize: number;
}
