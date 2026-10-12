/** The profile page's tabs, as its `?tab=` query param. */
export const ProfileTabs = {
  Details: 'details',
  Coaches: 'coaches',
  Billing: 'billing',
  Notifications: 'notifications',
  Safety: 'safety',
} as const;

export type ProfileTab = (typeof ProfileTabs)[keyof typeof ProfileTabs];
