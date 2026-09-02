import type { Signal } from '@angular/core';
import type { NavMode } from 'core';

/**
 * A tab's id is its route segment directly under `/tabs` — which is also the
 * key Ionic uses for that tab's navigation stack (`computeStackId`) and the
 * value bound to `ion-tab-button[tab]`. The three must stay identical, so
 * they are one value rather than three fields.
 *
 * `Coach` and `User` are role segments, not feature names: each role's
 * sessions area lives under its own prefix (`/tabs/coach/sessions`,
 * `/tabs/user/sessions`) so the two surfaces keep separate stacks and
 * separate deep-link addresses. Both tab buttons still read "Sessions".
 */
export const TabIds = {
  Home: 'home',
  Clients: 'clients',
  Coach: 'coach',
  User: 'user',
  Workouts: 'workouts',
  Discover: 'discover',
  Messages: 'messages',
  Groups: 'groups',
  Programs: 'programs',
  Exercises: 'exercises',
  More: 'more',
} as const;

export type TabId = (typeof TabIds)[keyof typeof TabIds];

export interface TabItem {
  readonly id: TabId;
  readonly label: string;
  /** ionicons name, registered through `TAB_ICONS`. */
  readonly icon: string;
  /**
   * Live counter rendered as a badge, hidden at 0. Never set in the static
   * config — a plain const cannot inject a store, so the shell splices it in.
   */
  readonly badge?: Signal<number>;
}

/** A row of the menu page behind the Menu tab — reachable, but not worth a tab slot. */
export interface MoreTile {
  readonly label: string;
  readonly icon: string;
  /** Ionic palette name for the row's icon tile. */
  readonly iconColor: string;
  /** Absolute route; may point outside the tab set. */
  readonly route: string;
  /** Hidden from users without the INSTRUCTOR role. */
  readonly requiresInstructor?: boolean;
  /**
   * Marks the row and the Menu tab button with a dot when true. A count would
   * overstate it — the point is only that something is waiting. Spliced in at
   * render time, since a static entry cannot read a store.
   */
  readonly dot?: Signal<boolean>;
}

/**
 * A labeled group of More rows — the mobile counterpart of web's `NavSection`,
 * so the two menus keep the same grouped-by-intent architecture.
 */
export interface MoreSection {
  /** Section kicker; '' renders the card without a label (web's shared block). */
  readonly label: string;
  readonly items: readonly MoreTile[];
}

export interface TabSet {
  readonly mode: NavMode;
  readonly tabs: readonly TabItem[];
  readonly more: readonly MoreSection[];
  /** Where to land when this set becomes active and the current tab is gone. */
  readonly defaultTab: TabId;
}

/**
 * Mobile declares its own tab shape rather than reusing core's `NavItem`.
 * `NavItem.icon` carries a PrimeIcons class string (`'pi pi-home'`), while
 * Ionic needs a kebab icon name *and* the matching `ionicons` symbol for
 * `addIcons()` — putting that import in a file `web` and `website` consume is
 * not an option. `NavItem.route` is also the wrong concept here: a tab is
 * identified by its stack key, not by a route. Only `NavMode` is shared, so
 * the two shells can never disagree about 'coach' vs 'train'.
 */
