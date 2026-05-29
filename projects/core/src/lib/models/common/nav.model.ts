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

export interface NavSection {
  label: string;
  items: NavItem[];
}
