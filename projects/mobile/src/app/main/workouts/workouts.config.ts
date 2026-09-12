import {
  addOutline,
  backspaceOutline,
  barbellOutline,
  bodyOutline,
  calendarOutline,
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  close,
  ellipsisHorizontal,
  flameOutline,
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
  checkmarkOutline,
  chevronDownOutline,
  chevronForward,
  close,
  ellipsisHorizontal,
  flameOutline,
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

/** How long the in-progress log has been open, as the resume banner says it. */
export function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}:${String(mins % 60).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
