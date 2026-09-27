// Workout domain enums — mirror of beeactive-api
// `src/modules/workout/entities/workout.enums.ts`. Keep in sync.

export const ProgramKind = {
  Workout: 'WORKOUT',
  Meal: 'MEAL',
  Habit: 'HABIT',
  Hybrid: 'HYBRID',
} as const;
export type ProgramKind = (typeof ProgramKind)[keyof typeof ProgramKind];

export const ProgramStatus = {
  Draft: 'DRAFT',
  Published: 'PUBLISHED',
  Archived: 'ARCHIVED',
} as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

/**
 * Who authored a program.
 *
 * `SYSTEM` is MotionHive's own starter content, owned by nobody and readable
 * by everyone — which is why a coach's library can show rows they did not
 * write. The UI badges those so the distinction is visible rather than
 * inferred.
 */
export const ProgramSource = {
  System: 'SYSTEM',
  User: 'USER',
  Instructor: 'INSTRUCTOR',
} as const;

export type ProgramSource = (typeof ProgramSource)[keyof typeof ProgramSource];

/** The `library` query on `GET /programs` — whose content to return. */
export const ProgramLibrary = {
  /** Only what you authored. */
  Mine: 'mine',
  /** Only MotionHive's starter content. */
  System: 'system',
  /** Both, yours first. */
  All: 'all',
} as const;

export type ProgramLibrary = (typeof ProgramLibrary)[keyof typeof ProgramLibrary];

export const ProgramAssignmentStatus = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Completed: 'COMPLETED',
  Paused: 'PAUSED',
  Cancelled: 'CANCELLED',
} as const;
export type ProgramAssignmentStatus =
  (typeof ProgramAssignmentStatus)[keyof typeof ProgramAssignmentStatus];

export const WorkoutLogStatus = {
  InProgress: 'IN_PROGRESS',
  Completed: 'COMPLETED',
  Skipped: 'SKIPPED',
  Abandoned: 'ABANDONED',
} as const;
export type WorkoutLogStatus =
  (typeof WorkoutLogStatus)[keyof typeof WorkoutLogStatus];

export const ExerciseBlockKind = {
  None: 'NONE',
  Superset: 'SUPERSET',
  Circuit: 'CIRCUIT',
  Emom: 'EMOM',
  Amrap: 'AMRAP',
  Tabata: 'TABATA',
} as const;
export type ExerciseBlockKind =
  (typeof ExerciseBlockKind)[keyof typeof ExerciseBlockKind];

export const ExerciseSetType = {
  Normal: 'NORMAL',
  Warmup: 'WARMUP',
  Working: 'WORKING',
  Dropset: 'DROPSET',
  Failure: 'FAILURE',
  Amrap: 'AMRAP',
  RestPause: 'REST_PAUSE',
  Cluster: 'CLUSTER',
} as const;
export type ExerciseSetType =
  (typeof ExerciseSetType)[keyof typeof ExerciseSetType];

export const OneRepMaxSource = {
  Tested: 'TESTED',
  EstimatedEpley: 'ESTIMATED_EPLEY',
  EstimatedBrzycki: 'ESTIMATED_BRZYCKI',
  Manual: 'MANUAL',
} as const;
export type OneRepMaxSource =
  (typeof OneRepMaxSource)[keyof typeof OneRepMaxSource];

/**
 * Who wrote a routine. `SYSTEM` is a MotionHive starter: runnable by anyone,
 * editable by no one, and copyable into your own library.
 */
export const RoutineSources = {
  System: 'SYSTEM',
  User: 'USER',
  Instructor: 'INSTRUCTOR',
} as const;
export type RoutineSource = (typeof RoutineSources)[keyof typeof RoutineSources];

/** The input columns a set row can show, in display order. */
export const SetFields = {
  Weight: 'weight',
  Reps: 'reps',
  Duration: 'duration',
  Distance: 'distance',
} as const;
export type SetField = (typeof SetFields)[keyof typeof SetFields];
