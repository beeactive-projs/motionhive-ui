// Exercise domain enums. Const + type pattern so they're runtime-accessible
// (for chip rendering / select options) AND narrow at the type level.
// Mirror of beeactive-api `src/modules/exercise/entities/exercise.enums.ts`
// — keep in sync with migration 047 on the BE.

export const ExerciseSource = {
  System: 'SYSTEM',
  Instructor: 'INSTRUCTOR',
  Admin: 'ADMIN',
} as const;
export type ExerciseSource =
  (typeof ExerciseSource)[keyof typeof ExerciseSource];

export const ExerciseVisibility = {
  Private: 'PRIVATE',
  Public: 'PUBLIC',
} as const;
export type ExerciseVisibility =
  (typeof ExerciseVisibility)[keyof typeof ExerciseVisibility];

export const ExerciseKind = {
  Strength: 'STRENGTH',
  Cardio: 'CARDIO',
  Duration: 'DURATION',
  Distance: 'DISTANCE',
  Bodyweight: 'BODYWEIGHT',
  Mobility: 'MOBILITY',
} as const;
export type ExerciseKind = (typeof ExerciseKind)[keyof typeof ExerciseKind];

export const ExerciseForce = {
  Push: 'PUSH',
  Pull: 'PULL',
  Static: 'STATIC',
} as const;
export type ExerciseForce = (typeof ExerciseForce)[keyof typeof ExerciseForce];

export const ExerciseMechanic = {
  Compound: 'COMPOUND',
  Isolation: 'ISOLATION',
} as const;
export type ExerciseMechanic =
  (typeof ExerciseMechanic)[keyof typeof ExerciseMechanic];

export const ExerciseLevel = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
} as const;
export type ExerciseLevel = (typeof ExerciseLevel)[keyof typeof ExerciseLevel];

export const MovementPattern = {
  Squat: 'SQUAT',
  Hinge: 'HINGE',
  Lunge: 'LUNGE',
  PushHorizontal: 'PUSH_HORIZONTAL',
  PushVertical: 'PUSH_VERTICAL',
  PullHorizontal: 'PULL_HORIZONTAL',
  PullVertical: 'PULL_VERTICAL',
  Carry: 'CARRY',
  Rotation: 'ROTATION',
  AntiRotation: 'ANTI_ROTATION',
  Locomotion: 'LOCOMOTION',
  Isolation: 'ISOLATION',
} as const;
export type MovementPattern =
  (typeof MovementPattern)[keyof typeof MovementPattern];

export const MuscleRole = {
  Primary: 'PRIMARY',
  Secondary: 'SECONDARY',
  Stabilizer: 'STABILIZER',
} as const;
export type MuscleRole = (typeof MuscleRole)[keyof typeof MuscleRole];

export const ExerciseMediaKind = {
  Youtube: 'YOUTUBE',
  Video: 'VIDEO',
  Image: 'IMAGE',
  Gif: 'GIF',
  None: 'NONE',
} as const;
export type ExerciseMediaKind =
  (typeof ExerciseMediaKind)[keyof typeof ExerciseMediaKind];

/**
 * Ownership tab on the catalog (design S1 / S6). The FE pill row maps
 * one-to-one to these values; the BE accepts them on `?ownership=`.
 */
export const ExerciseOwnershipFilter = {
  All: 'all',
  System: 'system',
  Mine: 'mine',
  PublicOthers: 'public-others',
} as const;
export type ExerciseOwnershipFilter =
  (typeof ExerciseOwnershipFilter)[keyof typeof ExerciseOwnershipFilter];

export const ExerciseSortKey = {
  Name: 'name',
  Newest: 'newest',
  MostForked: 'most-forked',
} as const;
export type ExerciseSortKey =
  (typeof ExerciseSortKey)[keyof typeof ExerciseSortKey];
