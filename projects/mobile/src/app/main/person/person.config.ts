import { ClientRequestTypes, ProfileWorkout, PublicUserProfile, enumLabel } from 'core';
import {
  alertCircleOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  createOutline,
  ellipsisHorizontal,
  flagOutline,
  informationCircleOutline,
  languageOutline,
  lockClosedOutline,
  mailOutline,
  openOutline,
  pulseOutline,
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
  informationCircleOutline,
  languageOutline,
  lockClosedOutline,
  mailOutline,
  openOutline,
  pulseOutline,
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
 * The coaching verb a coach's profile offers in its footer, beside Message:
 * the reader's side of what a coach's Invite is on theirs.
 */
export const CoachingCtas = {
  /** Ask this coach to coach you. */
  Request: 'request',
  /** You asked and they have not answered: say so, and offer Withdraw. */
  Requested: 'requested',
  /** They invited you: the answer is right here. */
  Invited: 'invited',
} as const;

export type CoachingCta = (typeof CoachingCtas)[keyof typeof CoachingCtas];

/**
 * A note to a coach, capped at what their request sheet reads at a glance
 * (the API allows 1000). Same cap as a coach's note on an invitation.
 */
export const REQUEST_MESSAGE_MAX_LENGTH = 500;

/** How long a request stays open before it lapses (the API's `expiresAt`). */
export const REQUEST_EXPIRY_DAYS = 30;

/**
 * Which coaching verb, if any, a profile offers. None on your own page, on
 * someone who is not a coach, or on your coach. A pending request decides
 * before anything else, because any pending request between the two blocks
 * a new one: one you sent reads as sent, an invitation from them as an
 * invitation, and one about the other way round (you coaching them) leaves
 * nothing to ask. Otherwise a coach taking new clients can be asked; one who
 * is not, or whose profile has not landed yet (`acceptingClients` null), offers
 * nothing rather than a button the API would refuse.
 */
export function coachingCta(
  profile: PublicUserProfile | null,
  options: { isSelf: boolean; acceptingClients: boolean | null },
): CoachingCta | null {
  if (!profile || options.isSelf || !profile.isInstructor) return null;
  if (profile.yourCoachSince) return null;

  const pending = profile.pendingRequest;
  if (pending) {
    if (pending.sentByYou && pending.type === ClientRequestTypes.ClientToInstructor) {
      return CoachingCtas.Requested;
    }
    if (!pending.sentByYou && pending.type === ClientRequestTypes.InstructorToClient) {
      return CoachingCtas.Invited;
    }
    return null;
  }

  return options.acceptingClients ? CoachingCtas.Request : null;
}

/**
 * A role as the profile screens name it — `INSTRUCTOR` is "Coach".
 * `displayRoles` arrives as raw role names, with USER already filtered out
 * server-side.
 */
export function roleLabel(role: string): string {
  return enumLabel('userRole', role);
}
