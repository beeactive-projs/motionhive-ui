import type { Signal } from '@angular/core';
import type { NavMode } from 'core';

/**
 * A tab's id is its route segment directly under `/tabs` — which is also the
 * key Ionic uses for that tab's navigation stack (`computeStackId`) and the
 * value bound to `ion-tab-button[tab]`. The three must stay identical, so
 * they are one value rather than three fields.
 */
export const TabIds = {
  Home: 'home',
  Clients: 'clients',
  Sessions: 'sessions',
  Workouts: 'workouts',
  Discover: 'discover',
  Messages: 'messages',
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

/** An entry in the "More" sheet — reachable, but not worth a tab slot. */
export interface MoreTile {
  readonly label: string;
  readonly icon: string;
  /** Absolute route; may point outside the tab set. */
  readonly route: string;
  /** Hidden from users without the INSTRUCTOR role. */
  readonly requiresInstructor?: boolean;
}

export interface TabSet {
  readonly mode: NavMode;
  readonly tabs: readonly TabItem[];
  readonly more: readonly MoreTile[];
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
