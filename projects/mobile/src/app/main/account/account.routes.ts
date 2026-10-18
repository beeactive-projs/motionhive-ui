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
    title: 'pageTitle.account',
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile').then((m) => m.Profile),
    title: 'pageTitle.profile',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notifications/notifications').then((m) => m.AccountNotifications),
    title: 'pageTitle.notifications',
  },
  {
    path: 'blocked',
    loadComponent: () => import('./blocked-users/blocked-users').then((m) => m.BlockedUsers),
    title: 'pageTitle.blockedUsers',
  },
  {
    // Only a coach has a coaching profile to look at.
    path: 'coaching',
    canActivate: [coachGuard],
    loadComponent: () =>
      import('./coaching-profile/coaching-profile').then((m) => m.CoachingProfile),
    title: 'pageTitle.coachingProfile',
  },
  {
    // Behind a row at the end of Account, past an explanation, a code and a
    // word to type: findable, never one tap away.
    path: 'delete',
    loadComponent: () =>
      import('./delete-account/delete-account').then((m) => m.DeleteAccount),
    title: 'pageTitle.deleteAccount',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy').then((m) => m.AccountPrivacy),
    title: 'pageTitle.privacy',
  },
];
