/** Rests a coach picks from, the same ones the mobile builders offer. */
export const REST_CHOICES = [45, 60, 90, 120, 150, 180, 240, 300] as const;

/** 90 → "1:30". */
export function restClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
