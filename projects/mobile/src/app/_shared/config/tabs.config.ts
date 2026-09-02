import { NavMode, NavModes } from 'core';
import {
  albumsOutline,
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubblesOutline,
  compassOutline,
  flashOutline,
  homeOutline,
  menuOutline,
  peopleCircleOutline,
  peopleOutline,
  personAddOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';

import { MoreTile, TabId, TabIds, TabItem, TabSet } from '../models/tab.model';

/**
 * Every icon the shell renders, in one place so `addIcons()` and the kebab
 * name strings below cannot drift apart.
 */
export const TAB_ICONS = {
  albumsOutline,
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubblesOutline,
  compassOutline,
  flashOutline,
  homeOutline,
  menuOutline,
  peopleCircleOutline,
  peopleOutline,
  personAddOutline,
  swapHorizontalOutline,
};

// Tabs shared by both modes — same id, so Ionic keeps one stack across a swap.
const HOME: TabItem = { id: TabIds.Home, label: 'Home', icon: 'home-outline' };
const MESSAGES: TabItem = {
  id: TabIds.Messages,
  label: 'Messages',
  icon: 'chatbubbles-outline',
};

// Groups sits in web's shared nav block, so both modes carry the same row.
// Slate wash on purpose: honey is reserved for actions/selection, and the
// coloured hues are taken by this row's coach-mode neighbours.
const GROUPS: MoreTile = {
  label: 'Groups',
  icon: 'people-circle-outline',
  iconColor: 'medium',
  route: '/tabs/groups',
};

export const COACH_TAB_SET: TabSet = {
  mode: NavModes.Coach,
  defaultTab: TabIds.Home,
  tabs: [
    HOME,
    { id: TabIds.Clients, label: 'Clients', icon: 'people-outline' },
    // Role segment as the id: the coach sessions area lives under
    // `/tabs/coach/sessions` (see tab.model.ts).
    { id: TabIds.Coach, label: 'Sessions', icon: 'calendar-outline' },
    MESSAGES,
  ],
  // Grouped by intent, mirroring web's rail: the coaching workspace first,
  // then the shared community destinations. Account has no row: the menu
  // page's identity card is the way in.
  more: [
    {
      label: 'Coaching',
      items: [
        {
          label: 'Requests',
          icon: 'person-add-outline',
          iconColor: 'info',
          route: '/tabs/clients/requests',
          requiresInstructor: true,
        },
        { label: 'Programs', icon: 'albums-outline', iconColor: 'violet', route: '/tabs/programs' },
        { label: 'Exercises', icon: 'flash-outline', iconColor: 'coral', route: '/tabs/exercises' },
        {
          label: 'Payments',
          icon: 'card-outline',
          iconColor: 'success',
          route: '/tabs/home/payments',
        },
      ],
    },
    {
      label: 'Community',
      items: [
        { label: 'Discover', icon: 'compass-outline', iconColor: 'teal', route: '/tabs/discover' },
        GROUPS,
      ],
    },
  ],
};

export const TRAIN_TAB_SET: TabSet = {
  mode: NavModes.Train,
  defaultTab: TabIds.Home,
  tabs: [
    HOME,
    // The trainee's bookings — `/tabs/user/sessions`. Sessions earned the tab
    // slot; Workouts moved to the menu page until it ships real content.
    { id: TabIds.User, label: 'Sessions', icon: 'calendar-outline' },
    { id: TabIds.Discover, label: 'Discover', icon: 'compass-outline' },
    MESSAGES,
  ],
  // "My training" mirrors web's mode group; the unlabeled card holds the
  // shared/general rows, the way web's shared block carries no heading.
  more: [
    {
      label: 'My training',
      items: [
        {
          label: 'Workouts',
          icon: 'barbell-outline',
          iconColor: 'violet',
          route: '/tabs/workouts',
        },
      ],
    },
    {
      label: '',
      items: [
        GROUPS,
        {
          label: 'Billing',
          icon: 'card-outline',
          iconColor: 'success',
          route: '/tabs/home/billing',
        },
      ],
    },
  ],
};

export const TAB_SETS: Record<NavMode, TabSet> = {
  [NavModes.Coach]: COACH_TAB_SET,
  [NavModes.Train]: TRAIN_TAB_SET,
};

/**
 * The mode the shell should actually render. Someone without the INSTRUCTOR
 * role has no second mode, so a stale stored `coach` must not give them a
 * coach tab bar they cannot use.
 *
 * This is the whole reason a single dual-mode shell also covers the
 * single-audience cases: a non-coach simply never leaves train mode.
 */
export function resolveMode(canSwitchMode: boolean, storedMode: NavMode): NavMode {
  return canSwitchMode ? storedMode : NavModes.Train;
}

/**
 * The active tab id — Ionic keys a page's navigation stack on the first URL
 * segment after `/tabs`, so that segment is what the tab bar must highlight.
 * Nested pages (`/tabs/clients/requests`) therefore keep their parent tab lit.
 */
export function activeTabIdFromUrl(url: string): TabId | undefined {
  const path = url.split('?')[0]?.split('#')[0] ?? '';
  const segments = path.split('/').filter(Boolean);
  return segments[0] === 'tabs' ? (segments[1] as TabId | undefined) : undefined;
}
