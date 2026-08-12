import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';

/**
 * The account area, mounted at `/tabs/home/account`.
 *
 * Every path here keeps `home` as the first segment after `/tabs`, which is
 * what `activeTabIdFromUrl` reads — so the Home tab stays lit through the whole
 * area instead of the bar going blank.
 */
export const accountRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./account').then((m) => m.Account),
    title: 'Account - MotionHive',
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile').then((m) => m.Profile),
    title: 'Profile - MotionHive',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notifications/notifications').then((m) => m.AccountNotifications),
    title: 'Notifications - MotionHive',
  },
  {
    path: 'blocked',
    loadComponent: () => import('./blocked-users/blocked-users').then((m) => m.BlockedUsers),
    title: 'Blocked users - MotionHive',
  },
  {
    // Only a coach has a coaching profile to look at.
    path: 'coaching',
    canActivate: [coachGuard],
    loadComponent: () =>
      import('./coaching-profile/coaching-profile').then((m) => m.CoachingProfile),
    title: 'Coaching profile - MotionHive',
  },
  {
    path: 'manage',
    loadComponent: () => import('./manage-account/manage-account').then((m) => m.ManageAccount),
    title: 'Manage account - MotionHive',
  },
];
