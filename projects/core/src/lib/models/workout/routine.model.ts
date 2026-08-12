export type RoutineSource = 'SYSTEM' | 'USER' | 'INSTRUCTOR';

/**
 * A routine is a person's own saved workout: a name plus an ordered list
 * of exercises with default sets, reps, weight and rest. Tap Start and it
 * materialises a fresh `WorkoutLog` with no assignment and the tree
 * pre-seeded.
 *
 * On the wire this is a `program` with `isSingleWorkout: true` (API
 * migration 056 unified plans, so a coach's multi-week program and a
 * self-authored routine share one model). `RoutineService` adapts the
 * nested program response into this flat shape, which is what the UI
 * thinks in. Keep the adapter there rather than teaching every component
 * about `workouts[0].exercises`.
 */
export interface Routine {
  id: string;
  /** Null for MotionHive starters — they belong to nobody. */
  ownerId: string | null;
  /**
   * Who wrote it. `SYSTEM` is a MotionHive starter: runnable by anyone,
   * editable by no one, and copyable into your own library.
   */
  source: RoutineSource;
  name: string;
  /** Maps to `program.description` on the wire. */
  notes: string | null;
  folder: string | null;
  /** Bumped on every successful start; sorts the list. */
  lastPerformedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  /**
   * How many exercises the routine holds. Present on list responses,
   * where the tree itself is omitted for weight.
   */
  exerciseCount: number;

  /** Flattened from the program's single workout. Detail responses only. */
  exercises?: RoutineExercise[];
}

export interface RoutineSet {
  setType: string;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  /** Holds and carries prescribe time, not reps. */
  targetDurationSeconds: number | null;
  restAfterSeconds: number | null;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  supersetGroupId: number | null;
  notes: string | null;
  /** Derived from the number of prescribed sets. */
  defaultSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restAfterSeconds: number | null;
  /**
   * The real per-set rows. `defaultSets` and the flat targets above are
   * a summary of these, kept so the simple editor keeps working; edit
   * these when the sets genuinely differ.
   */
  sets: RoutineSet[];
  /** True when the sets are not all identical, so a flat edit would lose data. */
  hasVariedSets: boolean;
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    thumbnailUrl: string | null;
  };
}

// ─── Wire shapes (what /programs actually returns) ───────────────────

export interface ProgramSetWire {
  orderIndex: number;
  setType: string;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | string | null;
  targetDurationSeconds: number | null;
  restAfterSeconds: number | null;
}

export interface ProgramExerciseWire {
  id: string;
  exerciseId: string;
  orderIndex: number;
  supersetGroupId: number | null;
  notes: string | null;
  exercise?: RoutineExercise['exercise'];
  sets?: ProgramSetWire[];
}

export interface ProgramWorkoutWire {
  id: string;
  name: string;
  exercises?: ProgramExerciseWire[];
}

export interface ProgramWire {
  /** Provenance stamp; absent on older responses. */
  source?: RoutineSource;
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
  folder: string | null;
  isSingleWorkout: boolean;
  lastPerformedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  exerciseCount?: number;
  workouts?: ProgramWorkoutWire[];
}

// ─── Payloads ────────────────────────────────────────────────────────

export interface CreateRoutineSetPayload {
  setType?: string;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetWeightKg?: number;
  targetDurationSeconds?: number;
  restAfterSeconds?: number;
}

export interface CreateRoutineExercisePayload {
  exerciseId: string;
  /** Explicit rows; takes precedence over `defaultSets`. */
  sets?: CreateRoutineSetPayload[];
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

/** Which library to read: yours, MotionHive's starters, or both. */
export type RoutineLibrary = 'mine' | 'system' | 'all';

export interface ListRoutinesQuery {
  page?: number;
  limit?: number;
  library?: RoutineLibrary;
}

export interface PaginatedRoutines {
  items: Routine[];
  total: number;
  page: number;
  pageSize: number;
}
