import { ExerciseLevel, MuscleRole } from '../models/exercise/exercise.enums';

/**
 * Single source of truth for exercise tag colours. Before this, card and
 * detail views each hand-picked Tailwind `bg-*` classes, so the same
 * concept (a muscle, a piece of equipment, a difficulty) looked different
 * depending on where it rendered. The palette is now systematised:
 *
 *   - muscle      → one sky family, ramped by role (primary strongest)
 *   - equipment   → neutral slate, visually distinct from the muscle hue
 *   - meta        → neutral surface (kind, movement pattern, mechanic, force)
 *   - difficulty  → a single green → yellow → red ramp (NOT brand amber —
 *                   honey/primary is reserved for actions)
 *
 * Apply the returned class to a `<p-tag>` via `[class]`.
 */

/** Muscle role → tag class. One sky family, ramped down by importance. */
export function exerciseMuscleTagClass(role: MuscleRole): string {
  switch (role) {
    case MuscleRole.Primary:
      return 'bg-sky-300 text-sky-800';
    case MuscleRole.Secondary:
      return 'bg-sky-100 text-sky-700';
    case MuscleRole.Stabilizer:
      return 'bg-surface-100 text-surface-600';
  }
}

/** Equipment chips — neutral slate, kept off the sky muscle hue. */
export const EXERCISE_EQUIPMENT_TAG_CLASS = 'bg-slate-200 text-slate-700';

/** Neutral meta chips: kind, movement pattern, mechanic, force, etc. */
export const EXERCISE_META_TAG_CLASS = 'bg-surface-100 text-surface-700';

export interface ExerciseLevelTag {
  /** Display label, e.g. "Beginner". */
  text: string;
  /** Tailwind classes for the `<p-tag>`. */
  class: string;
}

/**
 * Difficulty → a ramped traffic-light scale. No icon: read-only tags must
 * not carry caret/chevron icons (they read as an interactive dropdown).
 */
export function exerciseLevelTag(level: ExerciseLevel): ExerciseLevelTag {
  switch (level) {
    case ExerciseLevel.Beginner:
      return { text: 'Beginner', class: 'bg-green-100 text-green-800' };
    case ExerciseLevel.Intermediate:
      return { text: 'Intermediate', class: 'bg-yellow-100 text-yellow-800' };
    case ExerciseLevel.Advanced:
      return { text: 'Advanced', class: 'bg-red-100 text-red-800' };
  }
}
