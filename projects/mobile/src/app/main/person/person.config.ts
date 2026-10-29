import { ProfileWorkout, enumLabel } from 'core';
import {
  alertCircleOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  createOutline,
  ellipsisHorizontal,
  flagOutline,
  languageOutline,
  lockClosedOutline,
  mailOutline,
  openOutline,
  ribbonOutline,
  starOutline,
  timeOutline,
} from 'ionicons/icons';

import { monthGroups } from '../workouts/workouts.config';

/** Every icon this screen renders, registered in one place. */
export const PERSON_ICONS = {
  alertCircleOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  createOutline,
  ellipsisHorizontal,
  flagOutline,
  languageOutline,
  lockClosedOutline,
  mailOutline,
  openOutline,
  ribbonOutline,
  starOutline,
  timeOutline,
};

export const PersonTabs = {
  Activity: 'activity',
  About: 'about',
} as const;

export type PersonTab = (typeof PersonTabs)[keyof typeof PersonTabs];

/**
 * Which halves of a profile get a tab. Tabs only when both have something:
 * a segment over one tab is a control that does nothing. A coach's page
 * opens on About, since what they offer is why people open it; anyone
 * else's on what they have been doing.
 */
export function personTabs(has: { activity: boolean; about: boolean; isCoach: boolean }): {
  tabs: PersonTab[];
  initial: PersonTab | null;
} {
  if (has.activity && has.about) {
    return {
      tabs: [PersonTabs.Activity, PersonTabs.About],
      initial: has.isCoach ? PersonTabs.About : PersonTabs.Activity,
    };
  }
  if (has.activity) return { tabs: [], initial: PersonTabs.Activity };
  if (has.about) return { tabs: [], initial: PersonTabs.About };
  return { tabs: [], initial: null };
}

/** A month of someone's workouts, newest first, as Activity lists them. */
export interface WorkoutMonth {
  key: string;
  label: string;
  workouts: ProfileWorkout[];
}

/** Workouts under the local month they were done in (`monthGroups`). */
export function workoutMonths(workouts: readonly ProfileWorkout[]): WorkoutMonth[] {
  return monthGroups(workouts, (workout) => workout.completedAt).map(({ items, ...month }) => ({
    ...month,
    workouts: items,
  }));
}

/**
 * A role as the profile screens name it — `INSTRUCTOR` is "Coach".
 * `displayRoles` arrives as raw role names, with USER already filtered out
 * server-side.
 */
export function roleLabel(role: string): string {
  return enumLabel('userRole', role);
}
