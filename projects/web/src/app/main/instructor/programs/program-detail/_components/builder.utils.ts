import {
  ExerciseSetType,
  PrescribedExercise,
  PrescribedSet,
  ProgramWorkout,
  TagSeverity,
} from 'core';

/** Workouts grouped by week — the shape both the rail and the editor consume. */
export interface WeekGroup {
  week: number;
  workouts: ProgramWorkout[];
}

/** One-line target summary for a prescribed set — "8–12 reps · 60 kg · RPE 8". */
export function setSummary(s: PrescribedSet): string {
  const parts: string[] = [];
  if (s.targetRepsMin != null && s.targetRepsMax != null) {
    parts.push(
      s.targetRepsMin === s.targetRepsMax
        ? `${s.targetRepsMin} reps`
        : `${s.targetRepsMin}–${s.targetRepsMax} reps`,
    );
  } else if (s.targetRepsMin != null) {
    parts.push(`${s.targetRepsMin}+ reps`);
  }
  if (s.targetWeightKg != null) parts.push(`${s.targetWeightKg} kg`);
  else if (s.targetWeightPercent1rm != null) parts.push(`${s.targetWeightPercent1rm}% 1RM`);
  if (s.targetDurationSeconds != null) parts.push(`${s.targetDurationSeconds}s`);
  if (s.targetDistanceMeters != null) parts.push(`${s.targetDistanceMeters}m`);
  if (s.targetRpe != null) parts.push(`RPE ${s.targetRpe}`);
  if (s.targetRir != null) parts.push(`${s.targetRir} RIR`);
  return parts.length ? parts.join(' · ') : '—';
}

export function setTypeSeverity(s: ExerciseSetType): TagSeverity {
  switch (s) {
    case ExerciseSetType.Warmup:
      return TagSeverity.Info;
    case ExerciseSetType.Failure:
    case ExerciseSetType.Dropset:
      return TagSeverity.Danger;
    default:
      return TagSeverity.Secondary;
  }
}

/** Sets prescribed across a whole workout. */
export function workoutSetCount(workout: ProgramWorkout): number {
  let n = 0;
  for (const e of workout.exercises ?? []) n += e.sets?.length ?? 0;
  return n;
}

export function workoutExerciseCount(workout: ProgramWorkout): number {
  return workout.exercises?.length ?? 0;
}

/** Rest shared by every set of the exercise, or null when they differ / are unset. */
export function commonRestSeconds(ex: PrescribedExercise): number | null {
  const sets = ex.sets ?? [];
  if (sets.length === 0) return null;
  const first = sets[0].restAfterSeconds;
  if (first == null) return null;
  return sets.every((s) => s.restAfterSeconds === first) ? first : null;
}

/**
 * Duration shown on rail rows + the editor chip. The coach-entered
 * estimate wins; otherwise a rough derivation from set count and rest
 * (~45s of work per set), rounded to the nearest 5 minutes. Null when
 * there is nothing to estimate from — callers hide the chip.
 */
export function estimateWorkoutMinutes(workout: ProgramWorkout): number | null {
  if (workout.estimatedDurationMinutes) return workout.estimatedDurationMinutes;
  if (workoutSetCount(workout) === 0) return null;
  let seconds = 0;
  for (const e of workout.exercises ?? []) {
    for (const s of e.sets ?? []) seconds += 45 + (s.restAfterSeconds ?? 60);
  }
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

/**
 * Collapsed one-line prescription for an exercise row:
 * - all sets identical (type + targets) → "3 × 10–15 reps · RPE 8"
 * - warm-ups + identical working sets   → "2 warm-up + 3 × 10 reps · 60 kg"
 * - anything else                        → "4 sets · mixed"
 */
export function prescriptionSummary(ex: PrescribedExercise): string {
  const sets = ex.sets ?? [];
  if (sets.length === 0) return 'No sets';
  const sig = (s: PrescribedSet): string => `${s.setType}|${setSummary(s)}`;
  if (sets.every((s) => sig(s) === sig(sets[0]))) {
    return `${sets.length} × ${setSummary(sets[0])}`;
  }
  const working = sets.filter((s) => s.setType !== ExerciseSetType.Warmup);
  const warmups = sets.length - working.length;
  if (warmups > 0 && working.length > 0 && working.every((s) => sig(s) === sig(working[0]))) {
    return `${warmups} warm-up + ${working.length} × ${setSummary(working[0])}`;
  }
  return `${sets.length} sets · mixed`;
}
