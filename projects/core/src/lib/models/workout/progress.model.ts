/**
 * The "am I improving" surface. Everything here is derived server-side
 * from the workout log and the stored 1RM history, so there is no
 * progress table and nothing to keep in sync.
 */

export type ProgressRange = '4w' | '12w' | '1y';

export interface ProgressOverview {
  range: ProgressRange;
  totals: {
    workouts: number;
    /**
     * Sum of reps times weight over completed, loaded sets. Bodyweight
     * and cardio contribute nothing rather than zero-inflating it, so
     * the number stays comparable week to week.
     */
    volumeKg: number;
    setsCompleted: number;
    trainingSeconds: number;
  };
  /** Same window, shifted back once, so movement can be shown. */
  previous: { workouts: number; volumeKg: number };
  /** Consecutive weeks trained. Not windowed. */
  streak: { currentWeeks: number; bestWeeks: number };
  weeklyVolume: WeeklyVolumePoint[];
  dailyActivity: DailyActivityPoint[];
  records: ProgressRecord[];
  /** Lifetime count, used to choose the empty or near-empty state. */
  lifetimeWorkouts: number;
}

export interface WeeklyVolumePoint {
  /** ISO date of the Monday starting that week. */
  weekStart: string;
  volumeKg: number;
  workouts: number;
}

export interface DailyActivityPoint {
  date: string;
  workouts: number;
}

export interface ProgressRecord {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  recordedAt: string;
  /** Improvement on the previous best; equals the weight for a first. */
  deltaKg: number;
}

export interface ExerciseProgress {
  exercise: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    thumbnailUrl: string | null;
  };
  /** Oldest first, so a sparkline reads left to right. */
  oneRepMaxSeries: Array<{
    weightKg: number;
    recordedAt: string;
    source: string;
  }>;
  /** Newest first. */
  sessions: Array<{
    workoutLogId: string;
    performedAt: string;
    workoutName: string;
    setCount: number;
    topWeightKg: number | null;
    topReps: number | null;
    bestDurationSeconds: number | null;
    bestDistanceMeters: number | null;
  }>;
}
