import { startOfDay } from 'core';

/**
 * Day arithmetic the request screens share.
 *
 * Both sides of a coaching request count days the same way: the coach's
 * request sheet says how long an invitation has waited, and the trainee's
 * coaches page says when a coach invited them. Counting in whole local days
 * rather than in elapsed hours is what makes "yesterday" mean yesterday
 * rather than "19 hours ago".
 */

/** Whole local days from `iso` up to `now` — negative when `iso` is ahead. */
export function daysBetween(iso: string, now: number): number {
  const from = startOfDay(new Date(iso)).getTime();
  const to = startOfDay(new Date(now)).getTime();
  return Math.round((to - from) / 86_400_000);
}
