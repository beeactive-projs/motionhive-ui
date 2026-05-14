import { Routes } from '@angular/router';
import { authGuard } from 'core';
import { handleMatcher } from './pages/public-profile/handle-matcher';
import { publicHandleMatcher } from './pages/public-profile/public-handle-matcher';
import { guestOnlyMatchGuard } from './pages/public-profile/guest-only-match.guard';
import { redirectGuestToPublicGuard } from './pages/public-profile/redirect-guest-to-public.guard';
import { redirectAuthedToAppGuard } from './pages/public-profile/redirect-authed-to-app.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'error',
    loadChildren: () => import('./pages/error/error.routes').then((m) => m.errorRoutes),
  },

  // Canonical public share-target URL — `/public/@<handle>`. Always
  // renders the slim public chrome regardless of auth state, the way
  // share-target URLs do on other social platforms. The share dialog
  // generates this URL.
  {
    matcher: publicHandleMatcher,
    canActivate: [redirectAuthedToAppGuard],
    loadChildren: () =>
      import('./pages/public-profile/public-profile-page.routes').then(
        (m) => m.publicProfilePageRoutes,
      ),
  },

  // `/@<handle>` for guests — redirect to `/public/@<handle>` so the
  // share URL is always the canonical one. `canMatch` lets authed users
  // fall through to the in-`main` route below, where the profile renders
  // inside `SidenavLayout` (the in-app experience).
  {
    matcher: handleMatcher,
    canMatch: [guestOnlyMatchGuard],
    canActivate: [redirectGuestToPublicGuard],
    children: [],
  },

  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'photo/:postId',
        loadComponent: () =>
          import('./photo-viewer/photo-viewer').then((m) => m.PhotoViewer),
        title: 'Photo - MotionHive',
      },
      {
        path: '',
        loadChildren: () => import('./main/main.routes').then((m) => m.mainRoutes),
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'error/not-found',
  },
];
