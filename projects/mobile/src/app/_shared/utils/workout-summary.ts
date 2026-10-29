import { ProfileWorkout, appLocale, formatTotalDuration, translate } from 'core';

/**
 * "22 Oct · 52 min · 18 sets · 1 record": a shared workout's summary, the
 * same on a profile and in a group post. Only what the summary carries, and
 * each part only when there is one. A post already shows its date, so it
 * leaves that out.
 */
export function workoutSummaryLine(
  workout: Pick<
    ProfileWorkout,
    'completedAt' | 'durationSeconds' | 'setsCompleted' | 'recordCount'
  >,
  /** A row that badges its records leaves them out of the line. */
  options: { withDate?: boolean; withRecords?: boolean } = {},
): string {
  const parts: string[] = [];
  if (options.withDate && workout.completedAt) {
    parts.push(
      new Date(workout.completedAt).toLocaleDateString(appLocale(), {
        day: 'numeric',
        month: 'short',
      }),
    );
  }
  const seconds = workout.durationSeconds ?? 0;
  // Under a minute reads as "0m", which says nothing.
  if (seconds >= 60) parts.push(formatTotalDuration(seconds / 60));
  if (workout.setsCompleted > 0)
    parts.push(translate('count.sets', { count: workout.setsCompleted }));
  if (options.withRecords !== false && workout.recordCount > 0) {
    parts.push(translate('person.workouts.records', { count: workout.recordCount }));
  }
  return parts.join(' · ');
}
