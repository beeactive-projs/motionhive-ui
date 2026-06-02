import type {
  ExerciseBlockKind,
  ExerciseSetType,
  ProgramKind,
  ProgramStatus,
} from './workout.enums';

/**
 * One prescribed set inside a program workout — the master plan
 * authoritatively. Field names match the BE response 1:1.
 *
 * All target fields are optional; the parent exercise's `kind`
 * decides which the UI surfaces.
 */
export interface PrescribedSet {
  id: string;
  prescribedExerciseId: string;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Reference to the catalog exercise + role within a workout.
 * `exercise` is eager-loaded by the BE on `GET /programs/:id`.
 */
export interface PrescribedExercise {
  id: string;
  programWorkoutId: string;
  exerciseId: string;
  blockId: string | null;
  supersetGroupId: number | null;
  orderIndex: number;
  notes: string | null;
  alternateExerciseId: string | null;
  exercise?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    level: string;
    thumbnailUrl: string | null;
  };
  sets?: PrescribedSet[];
}

/**
 * One "day" inside a program. (weekIndex, dayIndex) uniquely positions
 * the workout in the calendar; `sequenceNumber` is the 0-based linear
 * index across the whole program.
 */
export interface ProgramWorkout {
  id: string;
  programId: string;
  name: string;
  notes: string | null;
  weekIndex: number;
  dayIndex: number;
  sequenceNumber: number;
  phase: string | null;
  estimatedDurationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  exercises?: PrescribedExercise[];
}

/**
 * Optional grouping (superset / circuit / EMOM / AMRAP / TABATA). V1
 * UI ships SUPERSET only; the rest exist on schema for forward-compat.
 */
export interface ExerciseBlock {
  id: string;
  programWorkoutId: string;
  kind: ExerciseBlockKind;
  orderIndex: number;
  rounds: number | null;
  durationSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  notes: string | null;
  createdAt: string;
}

/**
 * Top-level Program — owner-scoped library of an instructor.
 *
 * `kind` reserves MEAL / HABIT / HYBRID for future modules; V1 ships
 * only `WORKOUT` (BE forward-compat).
 */
export interface Program {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  kind: ProgramKind;
  status: ProgramStatus;
  durationWeeks: number | null;
  periodizationModel: string | null;
  coverImageUrl: string | null;
  goalTags: string[] | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Eager-loaded on detail view
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  workouts?: ProgramWorkout[];
}

// ─── Query / payload shapes ──────────────────────────────────────────

export interface ListProgramsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProgramStatus;
}

export interface PaginatedPrograms {
  items: Program[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProgramPayload {
  name: string;
  description?: string;
  kind?: ProgramKind;
  status?: ProgramStatus;
  durationWeeks?: number;
  periodizationModel?: string;
  coverImageUrl?: string;
  goalTags?: string[];
}

export type UpdateProgramPayload = Partial<CreateProgramPayload>;

export interface CreateProgramWorkoutPayload {
  name: string;
  notes?: string;
  weekIndex: number;
  dayIndex: number;
  phase?: string;
  estimatedDurationMinutes?: number;
}

export type UpdateProgramWorkoutPayload = Partial<CreateProgramWorkoutPayload>;

export interface CreatePrescribedExercisePayload {
  exerciseId: string;
  supersetGroupId?: number;
  alternateExerciseId?: string;
  blockId?: string;
  notes?: string;
  orderIndex?: number;
}

export type UpdatePrescribedExercisePayload =
  Partial<CreatePrescribedExercisePayload>;

export interface CreatePrescribedSetPayload {
  setType?: ExerciseSetType;
  orderIndex?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetWeightKg?: number;
  targetWeightPercent1rm?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
  targetRir?: number;
  restAfterSeconds?: number;
  tempo?: string;
  notes?: string;
}

export type UpdatePrescribedSetPayload = Partial<CreatePrescribedSetPayload>;
