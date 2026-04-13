import type { UserRole } from '../user/role.enums';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  external?: boolean;
  action?: 'stripe-dashboard';
}

export interface NavSection {
  label: string;
  items: NavItem[];
  roleRequired?: UserRole;
}
