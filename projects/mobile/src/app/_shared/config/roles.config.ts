import { NavMode, NavModes } from 'core';
import { barbellOutline, businessOutline, chevronDown, peopleOutline } from 'ionicons/icons';

/** One switchable role, as the pill and the switch-role page render it. */
export interface RoleOption {
  readonly mode: NavMode;
  readonly label: string;
  readonly icon: string;
  /** What changes when you pick it — home, tabs and notifications. */
  readonly description: string;
  /** Ionic palette name for the hexagon tile. */
  readonly color: string;
}

/** A role the account cannot hold yet — rendered disabled, never selectable. */
export interface UpcomingRole {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

/**
 * Icons the role surfaces render, in one place so `addIcons()` and the kebab
 * name strings below cannot drift apart — same contract as `TAB_ICONS`.
 */
export const ROLE_ICONS = { barbellOutline, businessOutline, chevronDown, peopleOutline };

/**
 * `NavMode` is the persisted workspace mode; this is how that mode is *named*
 * to the user. "Train" is the mode, "Trainee" is the role — the UI only ever
 * says the latter.
 */
export const ROLES: Record<NavMode, RoleOption> = {
  [NavModes.Coach]: {
    mode: NavModes.Coach,
    label: 'Coach',
    icon: 'people-outline',
    description: 'Your clients, sessions and earnings.',
    color: 'primary',
  },
  [NavModes.Train]: {
    mode: NavModes.Train,
    label: 'Trainee',
    icon: 'barbell-outline',
    description: 'Your workouts, coaches and plans.',
    color: 'secondary',
  },
};

/** Insertion order — Coach first, matching the switch-role page. */
export const ROLE_LIST: readonly RoleOption[] = Object.values(ROLES);

export const UPCOMING_ROLES: readonly UpcomingRole[] = [];
