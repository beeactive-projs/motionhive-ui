import { Routes } from '@angular/router';

/**
 * Public-profile child routes. The page itself is a single-scroll layout
 * (About / Work with me / Communities are rendered inline as section
 * cards), so there are no tab children. The only remaining routes are
 * the `contact` and `share` deep links — they don't render anything of
 * their own; the parent shell reads `data.openDialog` from the
 * activated child snapshot and flips the corresponding dialog signal.
 */
export const publicProfileTabRoutes: Routes = [
  {
    path: 'contact',
    data: { openDialog: 'contact' },
    children: [],
  },
  {
    path: 'share',
    data: { openDialog: 'share' },
    children: [],
  },
];

/**
 * Authed mount of the public profile (used from `main.routes.ts`). The
 * guest mount in `pages/public-profile/public-profile-page.routes.ts`
 * reuses `publicProfileTabRoutes` directly so the URL surface stays
 * identical in both layouts.
 */
export const publicProfileRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public-profile').then((m) => m.PublicProfile),
    children: publicProfileTabRoutes,
  },
];
