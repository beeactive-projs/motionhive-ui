import type { Signal } from '@angular/core';
import type { UserRole } from '../user/role.enums';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  external?: boolean;
  action?: 'stripe-dashboard';
  /**
   * Optional live unread counter. Wire a store signal here and the
   * sidenav renders a coral pill that updates without re-creating the
   * NavSection array. Hidden when the value is 0 or absent.
   *
   * Used today by the Messages entry (MessagingStore.unreadTotal).
   * Future: group join requests, notification bell totals.
   */
  badge?: Signal<number>;
}

/**
 * Sidebar workspace mode. Sections tagged with a mode belong to the
 * Coach/Train toggle and only render when that mode is active. Untagged
 * sections (common nav, admin, content) always render.
 */
export type NavMode = 'coach' | 'train';

export interface NavSection {
  label: string;
  items: NavItem[];
  /** When set, this section is shown only while the matching sidebar mode is active. */
  mode?: NavMode;
}
