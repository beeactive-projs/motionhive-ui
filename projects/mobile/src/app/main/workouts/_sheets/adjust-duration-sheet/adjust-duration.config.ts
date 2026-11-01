import { WorkoutLog, formatTotalDuration } from 'core';

/**
 * The rules of Adjust duration (design "Share v3", 2), apart from the
 * sheet so they are tested (`adjust-duration.config.spec.ts`). The API
 * holds the same bounds (`SetWorkoutDurationDto`).
 */

/** The longest a workout can last: past it a measured duration is stored as unknown. */
export const DURATION_MAX_SECONDS = 6 * 60 * 60;
/** The shortest correction, the wheels' step. */
export const DURATION_MIN_SECONDS = 60;

export const HOUR_CHOICES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const MINUTE_CHOICES: readonly number[] = Array.from({ length: 60 }, (_, minute) => minute);

/** The wheels for a length in seconds: to the nearest minute, within bounds. */
export function splitDuration(seconds: number | null | undefined): {
  hours: number;
  minutes: number;
} {
  const total = Math.round(clampSeconds(seconds ?? 0) / 60);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** The wheels back to seconds, kept within a minute and six hours. */
export function joinDuration(hours: number, minutes: number): number {
  return clampSeconds((hours * 60 + minutes) * 60);
}

function clampSeconds(seconds: number): number {
  return Math.min(DURATION_MAX_SECONDS, Math.max(DURATION_MIN_SECONDS, Math.round(seconds)));
}

/** Whether the wheels say a length a workout can have: a minute to six hours. */
export function minuteAllowed(hours: number, minute: number): boolean {
  return hours * 60 + minute <= DURATION_MAX_SECONDS / 60 && hours * 60 + minute >= 1;
}

/**
 * Where the wheels settle after a pick they cannot hold: six hours with
 * minutes goes back to six hours, nothing at all to a minute. No option is
 * ever disabled: Ionic re-centres a wheel one step off when one changes
 * state under it, so the wheels snap back instead.
 */
export function settleWheels(hours: number, minutes: number): { hours: number; minutes: number } {
  if (hours * 60 + minutes > DURATION_MAX_SECONDS / 60) return { hours, minutes: 0 };
  if (hours === 0 && minutes === 0) return { hours, minutes: 1 };
  return { hours, minutes };
}

/**
 * What the clock measured, worked out again from the start, the end of
 * training and the pauses the API keeps, as it worked it out on Finish.
 * Past six hours it was stored as unknown, and so it reads here: null.
 */
export function recordedSeconds(
  log: Pick<WorkoutLog, 'startedAt' | 'completedAt' | 'pausedSeconds'>,
): number | null {
  if (!log.completedAt) return null;
  const open = Math.round(
    (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000,
  );
  const seconds = Math.max(0, open - (log.pausedSeconds ?? 0));
  return seconds > DURATION_MAX_SECONDS ? null : seconds;
}

/** "1 h 12 min", "52 min": a length as the app says it everywhere. */
export function durationWords(seconds: number): string {
  return formatTotalDuration(Math.max(1, Math.round(seconds / 60)));
}
