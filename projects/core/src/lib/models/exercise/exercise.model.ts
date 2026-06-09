import type { Equipment } from './equipment.model';
import type { Muscle } from './muscle.model';
import type {
  ExerciseForce,
  ExerciseKind,
  ExerciseLevel,
  ExerciseMechanic,
  ExerciseMediaKind,
  ExerciseOwnershipFilter,
  ExerciseSortKey,
  ExerciseSource,
  ExerciseVisibility,
  MovementPattern,
  MuscleRole,
} from './exercise.enums';

/**
 * One media row on an exercise — start/end image pair for SYSTEM
 * exercises, YouTube thumbnail for custom, etc. Provider is a free
 * string so future sources (MuscleWiki) drop in without enum changes.
 */
export interface ExerciseMedia {
  id: string;
  exerciseId: string;
  provider: string;
  providerAssetId: string | null;
  kind: ExerciseMediaKind;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  displayOrder: number;
  isPrimary: boolean;
  licensedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Muscle row eager-loaded via the `exercise_muscle` join — carries
 * the role for this specific exercise.
 */
export interface ExerciseMuscleRole {
  exerciseId: string;
  muscleId: string;
  role: MuscleRole;
  muscle?: Muscle;
}

/**
 * Author identity (denormalized owner reference) — null for SYSTEM
 * exercises. The BE projects only the fields the FE attribution chip
 * needs; do not assume the full User shape is available here.
 */
export interface ExerciseOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  handle: string | null;
}

/**
 * Fork-lineage reference — present when the exercise was forked from
 * another. Carries enough to render the "Forked from X" link.
 */
export interface ExerciseForkSourceRef {
  id: string;
  name: string;
  slug: string;
}

/**
 * Full exercise row as returned by `GET /exercises/:id` (and from
 * list endpoints when includes are eager-loaded). Field names match
 * the BE response 1:1; do not rename on the FE.
 */
export interface Exercise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instructions: string | null;

  kind: ExerciseKind;
  level: ExerciseLevel;
  movementPattern: MovementPattern | null;
  mechanic: ExerciseMechanic | null;
  force: ExerciseForce | null;
  metValue: number | null;

  source: ExerciseSource;
  ownerId: string | null;
  visibility: ExerciseVisibility;
  forkedFromId: string | null;

  sourceProvider: string | null;
  sourceExternalId: string | null;

  mediaKind: ExerciseMediaKind;
  thumbnailUrl: string | null;
  youtubeUrl: string | null;

  trackingFields: string[] | null;
  isUnilateral: boolean;
  forkCount: number;

  fitCategory: string | null;
  fitSubcategory: string | null;
  hkActivityType: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Eager-loaded includes (present on detail; partial on list)
  owner?: ExerciseOwnerRef | null;
  forkedFrom?: ExerciseForkSourceRef | null;
  media?: ExerciseMedia[];
  muscleRoles?: ExerciseMuscleRole[];
  equipment?: Equipment[];
}

// ─── Query / payload shapes ──────────────────────────────────────────

/**
 * Query string for `GET /exercises`. Array fields are sent as
 * comma-separated strings; the BE DTO splits them via a Transform.
 */
export interface ListExercisesQuery {
  page?: number;
  limit?: number;
  search?: string;
  kind?: ExerciseKind[];
  primaryMuscleId?: string[];
  equipmentId?: string[];
  level?: ExerciseLevel[];
  movementPattern?: MovementPattern[];
  mechanic?: ExerciseMechanic[];
  force?: ExerciseForce[];
  ownership?: ExerciseOwnershipFilter;
  sort?: ExerciseSortKey;
  withFacets?: boolean;
}

/**
 * Per-facet aggregate counts returned when `?withFacets=true`. Each
 * map's keys are either enum values (kind/level) or UUIDs (muscle/
 * equipment); render via lookup against the taxonomy store.
 */
export interface ExerciseFacets {
  kind?: Record<string, number>;
  primaryMuscleId?: Record<string, number>;
  equipmentId?: Record<string, number>;
  level?: Record<string, number>;
}

/**
 * Paginated catalog response. Shape matches the global `Paginated<T>`
 * contract (items / total / page / pageSize) — see integration.md.
 * `facets` is present only when the caller passed `withFacets=true`.
 */
export interface PaginatedExercises {
  items: Exercise[];
  total: number;
  page: number;
  pageSize: number;
  facets?: ExerciseFacets;
}

/**
 * Body for `POST /exercises`. Mirrors `CreateExerciseDto`.
 *
 * `equipmentIds` empty / omitted → BE attaches the Bodyweight row.
 * `visibility` defaults to PRIVATE on the server; pass PUBLIC to
 * make the exercise visible to other instructors and forkable.
 */
export interface CreateExercisePayload {
  name: string;
  description?: string;
  instructions?: string;
  kind: ExerciseKind;
  level?: ExerciseLevel;
  movementPattern?: MovementPattern;
  mechanic?: ExerciseMechanic;
  force?: ExerciseForce;
  metValue?: number;
  isUnilateral?: boolean;
  youtubeUrl?: string;
  visibility?: ExerciseVisibility;
  muscles: { muscleId: string; role: MuscleRole }[];
  equipmentIds?: string[];
}

/** Body for `PATCH /exercises/:id`. All fields optional (partial of Create). */
export type UpdateExercisePayload = Partial<CreateExercisePayload>;
