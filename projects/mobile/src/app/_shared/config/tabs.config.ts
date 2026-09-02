import { NavMode, NavModes } from 'core';
import {
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubblesOutline,
  compassOutline,
  ellipsisHorizontal,
  homeOutline,
  peopleOutline,
  personAddOutline,
} from 'ionicons/icons';

import { TabId, TabIds, TabItem, TabSet } from '../models/tab.model';

/**
 * Every icon the shell renders, in one place so `addIcons()` and the kebab
 * name strings below cannot drift apart.
 */
export const TAB_ICONS = {
  barbellOutline,
  calendarOutline,
  cardOutline,
  chatbubblesOutline,
  compassOutline,
  ellipsisHorizontal,
  homeOutline,
  peopleOutline,
  personAddOutline,
};

// Tabs shared by both modes — same id, so Ionic keeps one stack across a swap.
const HOME: TabItem = { id: TabIds.Home, label: 'Home', icon: 'home-outline' };
const MESSAGES: TabItem = {
  id: TabIds.Messages,
  label: 'Messages',
  icon: 'chatbubbles-outline',
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
  // Programs and Exercises belong here per the design, but they have no route
  // yet — a row that lands on the wrong page is worse than no row. They join
  // in M2 alongside their pages. Account has no row: the menu page's identity
  // card is the way in.
  more: [
    {
      label: 'Requests',
      icon: 'person-add-outline',
      iconColor: 'info',
      route: '/tabs/clients/requests',
      requiresInstructor: true,
    },
    { label: 'Discover', icon: 'compass-outline', iconColor: 'teal', route: '/tabs/discover' },
    { label: 'Payments', icon: 'card-outline', iconColor: 'success', route: '/tabs/home/payments' },
  ],
};

export const TRAIN_TAB_SET: TabSet = {
  mode: NavModes.Train,
  defaultTab: TabIds.Home,
  tabs: [
    HOME,
    // The trainee's bookings — `/tabs/user/sessions`. Sessions earned the tab
    // slot; Workouts moved to the More sheet until it ships real content.
    { id: TabIds.User, label: 'Sessions', icon: 'calendar-outline' },
    { id: TabIds.Discover, label: 'Discover', icon: 'compass-outline' },
    MESSAGES,
  ],
  // My plans and Profile join in M2 with their pages. Until then the menu
  // earns its place through Workouts, Billing and the identity card.
  more: [
    { label: 'Workouts', icon: 'barbell-outline', iconColor: 'violet', route: '/tabs/workouts' },
    { label: 'Billing', icon: 'card-outline', iconColor: 'success', route: '/tabs/home/billing' },
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
