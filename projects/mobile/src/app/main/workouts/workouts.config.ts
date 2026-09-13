import { formatTotalDuration } from 'core';
import {
  addOutline,
  backspaceOutline,
  barbellOutline,
  bodyOutline,
  calendarOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  close,
  ellipsisHorizontal,
  flameOutline,
  flashOutline,
  playOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  timeOutline,
  trashOutline,
  trendingUpOutline,
} from 'ionicons/icons';

/**
 * Every icon the workouts screens render. An unregistered name draws a blank
 * box with no error, so this list is the single place they are declared.
 */
export const WORKOUT_ICONS = {
  addOutline,
  backspaceOutline,
  barbellOutline,
  bodyOutline,
  calendarOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  close,
  ellipsisHorizontal,
  flameOutline,
  flashOutline,
  playOutline,
  playSkipForwardOutline,
  refreshOutline,
  removeOutline,
  repeatOutline,
  timeOutline,
  trashOutline,
  trendingUpOutline,
};

/**
 * Spine tones for routine rows, rotated by position the way the Discover
 * rails do it. Routines carry no inherent category, so a stable per-index
 * tone is what stops a list of them reading as one grey block.
 */
const ROUTINE_TONES = ['honey', 'teal', 'violet', 'navy', 'coral'] as const;

export function routineTone(index: number): string {
  return ROUTINE_TONES[index % ROUTINE_TONES.length];
}

/** "6 exercises · ~55 min · Barbell" — only the parts we actually know. */
export function workoutMetaLine(
  exerciseCount: number | null,
  minutes: number | null,
  equipment?: string | null,
): string {
  const parts: string[] = [];
  if (exerciseCount != null) {
    parts.push(`${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`);
  }
  if (minutes != null) parts.push(`~${minutes} min`);
  if (equipment) parts.push(equipment);
  return parts.join(' · ');
}

/**
 * "STRENGTH BLOCK · WEEK 3 · DAY 2" for the hero eyebrow. Week and day are
 * zero-based on the wire and one-based to a human.
 */
export function planPositionLabel(
  planName: string | null,
  weekIndex: number,
  dayIndex: number,
): string {
  const parts = [planName?.toUpperCase(), `WEEK ${weekIndex + 1}`, `DAY ${dayIndex + 1}`];
  return parts.filter(Boolean).join(' · ');
}

/**
 * A finished workout's length. Delegates to core's formatter so a duration
 * reads the same here as it does on a session — this was written out twice
 * in this feature alone before it moved here.
 */
export function workoutDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  return formatTotalDuration(seconds / 60);
}

/** How long the in-progress log has been open, as the resume banner says it. */
export function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}:${String(mins % 60).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * A duration as a clock. The API stores plain seconds, but nobody reads a
 * ninety-second plank as "90" — they read it as 1:30.
 */
export function secondsToClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  return `${mins}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Digits typed on a keypad, read right to left into seconds — the way every
 * timer input works. "130" is 1:30, i.e. 90 seconds; "45" is 0:45.
 */
export function clockDigitsToSeconds(digits: string): number | null {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return null;
  const padded = clean.padStart(3, '0');
  const secs = Number(padded.slice(-2));
  const mins = Number(padded.slice(0, -2));
  return mins * 60 + secs;
}

/** The same digits, shown back as the clock they are building. */
export function clockDigitsToDisplay(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '0:00';
  const padded = clean.padStart(3, '0');
  return `${Number(padded.slice(0, -2))}:${padded.slice(-2)}`;
}
