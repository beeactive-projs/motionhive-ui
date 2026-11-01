import { ProfileStacks, stackRootOf } from '../../_shared/utils/stack-paths';

/**
 * The screens Home opens that belong to another area too, and the links
 * they use when Home opened them.
 *
 * A tab keeps its own back stack and Ionic cannot pop across tabs, so a
 * page Home pushed onto another tab left back with a list behind it the
 * reader never visited (the Menu with no tab lit, the Workouts list). Each
 * of these is mounted in Home's stack as well (`home.routes.ts`) and reads
 * where it is from its URL: opened from Home, its back and its links stay
 * in Home; anywhere else nothing changes.
 */
export const HOME_STACK = ProfileStacks.Home;

/** The trainee's training area, where the live logger always runs. */
export const WORKOUTS_STACK = '/tabs/workouts';

/** Where a page opened from the Menu goes back to on a cold load. */
const MENU = '/tabs/more';

/** The other areas' pages Home mounts, by their address in its stack. */
export const HomePages = {
  /** The coach's agenda, from a Today row with two sessions or more. */
  Agenda: `${HOME_STACK}/sessions`,
  /** The trainee's bookings, from a Today row with two bookings or more. */
  Bookings: `${HOME_STACK}/bookings`,
  /** Discover's coaches, from "Find a coach". */
  Coaches: `${HOME_STACK}/coaches`,
  /** Discover's groups, from "Join a group". */
  GroupsToJoin: `${HOME_STACK}/groups-to-join`,
  /** Discover's search, from the header's search button. */
  Search: `${HOME_STACK}/search`,
  /** The invite page, from the first week's "Invite clients". */
  Invite: `${HOME_STACK}/invite`,
  /** The coaching profile, from "Add your specialties". */
  Coaching: `${HOME_STACK}/coaching`,
  /** The role switch, from the header's role pill. */
  SwitchRole: `${HOME_STACK}/switch-role`,
  /** The coach's whole hive, every client a cell, from the hive card. */
  Hive: `${HOME_STACK}/hive`,
  /** The trainee's month as a hive, a cell a day, from the week card. */
  Month: `${HOME_STACK}/month`,
  /** The exercise form, from the coach's "New exercise" shortcut. */
  NewExercise: `${HOME_STACK}/new-exercise`,
} as const;

/** True when the URL is Home or a page pushed onto it. */
export function inHomeStack(url: string): boolean {
  return stackRootOf(url) === HOME_STACK;
}

/** Home when the URL is in its stack, else `elsewhere`: a back on a cold load. */
export function homeOr(url: string, elsewhere: string): string {
  return inHomeStack(url) ? HOME_STACK : elsewhere;
}

/**
 * The coach's agenda: back on a cold load, and a session's page. In Home a
 * session opens in Home's own `session/:id`, as the single session of the
 * day does; in its own area, under the agenda.
 */
export function agendaLinks(url: string) {
  const home = inHomeStack(url);
  return {
    back: home ? HOME_STACK : MENU,
    session: (id: string): string[] =>
      home ? [HOME_STACK, 'session', id] : [ProfileStacks.CoachSessions, id],
  };
}

/**
 * The trainee's bookings: back on a cold load, a booking's page and the
 * cancelled ones. In Home a booking opens in Home's own `booking/:id`, as
 * the single booking of the day does.
 */
export function bookingsLinks(url: string) {
  const home = inHomeStack(url);
  return {
    back: home ? HOME_STACK : MENU,
    booking: (id: string): string[] =>
      home ? [HOME_STACK, 'booking', id] : [ProfileStacks.UserSessions, id],
    cancelled: home
      ? [HomePages.Bookings, 'cancelled']
      : [ProfileStacks.UserSessions, 'cancelled'],
  };
}

/**
 * A trainee's workout pages (a day's preview, a finished workout, an
 * exercise, a record's progress) in the stack they were opened in: Home's,
 * or the Workouts tab's. Starting a workout always goes to the Workouts
 * tab's logger, wherever the preview was.
 */
export function workoutLinks(url: string) {
  const root = inHomeStack(url) ? HOME_STACK : WORKOUTS_STACK;
  return {
    /** Where an exit lands: Home, or the Workouts tab. */
    root,
    preview: (assignmentId: string): string[] => [root, 'preview', assignmentId],
    finish: (workoutLogId: string): string[] => [root, 'finish', workoutLogId],
    exercise: (exerciseId: string): string[] => [root, 'exercise', exerciseId],
    /** Back from an exercise's progress on a cold load: Home, or the Progress tab. */
    progressBack: root === HOME_STACK ? HOME_STACK : `${WORKOUTS_STACK}/progress`,
  };
}
