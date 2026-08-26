import { Routes } from '@angular/router';
import { authGuard } from 'core';

import { coachGuard } from './_shared/guards/coach.guard';
import { TabIds } from './_shared/models/tab.model';

/**
 * The notification centre, mounted once under every tab.
 *
 * The bell sits in each tab's root header, and Ionic keys a page's stack on
 * the first segment after `/tabs` — so a single `/tabs/notifications` address
 * would drop the user out of the tab they opened it from. One route per tab
 * keeps the origin tab lit, at the cost of this loop.
 *
 * These must come first: the sessions areas and `messages` load child routes
 * with a `:id` parameter that would otherwise swallow `notifications`.
 */
const notificationRoutes: Routes = Object.values(TabIds).map((tab) => ({
  path: `${tab}/notifications`,
  loadComponent: () =>
    import('./main/notifications/notifications').then((m) => m.Notifications),
  title: 'Notifications - MotionHive',
}));

/**
 * Pages that are reachable but do not own a tab (Settings, Requests) are nested
 * under the tab they belong to rather than sitting beside it. Ionic derives a
 * page's navigation stack from the first URL segment after `/tabs`, so a
 * top-level `/tabs/settings` would open a stack with no matching tab button and
 * leave the bar showing nothing selected for the whole visit.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/tabs/tabs').then((m) => m.Tabs),
    children: [
      ...notificationRoutes,
      {
        path: 'home',
        loadComponent: () => import('./main/home/home').then((m) => m.Home),
      },
      {
        path: 'home/account',
        loadChildren: () =>
          import('./main/account/account.routes').then((m) => m.accountRoutes),
      },
      {
        // Only an instructor holds a second role, so only an instructor has
        // anything to switch between.
        path: 'home/switch-role',
        canActivate: [coachGuard],
        loadComponent: () =>
          import('./main/home/switch-role/switch-role').then((m) => m.SwitchRole),
      },
      // Money, both sides, under `home` so the Home tab stays lit. Neither
      // gets a tab: a coach chases payment deliberately, and a client's bill
      // is rare enough that a permanent slot would sit empty.
      {
        path: 'home/payments',
        loadChildren: () =>
          import('./main/payments/payments.routes').then((m) => m.paymentsRoutes),
      },
      {
        path: 'home/billing',
        loadChildren: () =>
          import('./main/payments/payments.routes').then((m) => m.billingRoutes),
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./main/messages/messages.routes').then((m) => m.messagesRoutes),
      },
      {
        path: 'clients',
        canActivate: [coachGuard],
        loadComponent: () => import('./main/clients/clients').then((m) => m.Clients),
      },
      {
        path: 'clients/requests',
        canActivate: [coachGuard],
        loadComponent: () => import('./main/requests/requests').then((m) => m.Requests),
      },
      // Role-prefixed sessions areas: each role keeps its own stack and its
      // own deep-link address, and the tab buttons navigate to the bare role
      // segment — hence the redirects. The trainee side needs no guard beyond
      // the parent authGuard: any authenticated user can hold bookings.
      { path: 'coach', redirectTo: 'coach/sessions', pathMatch: 'full' },
      {
        path: 'coach/sessions',
        canActivate: [coachGuard],
        loadChildren: () =>
          import('./main/coach/sessions/sessions.routes').then((m) => m.sessionsRoutes),
      },
      { path: 'user', redirectTo: 'user/sessions', pathMatch: 'full' },
      {
        path: 'user/sessions',
        loadChildren: () =>
          import('./main/user/sessions/sessions.routes').then(
            (m) => m.userSessionsRoutes,
          ),
      },
      // The pre-split address, kept so restored URLs and stale notification
      // taps still land somewhere sensible.
      { path: 'sessions', redirectTo: 'coach/sessions' },
      {
        path: 'workouts',
        loadComponent: () => import('./main/workouts/workouts').then((m) => m.Workouts),
      },
      {
        path: 'discover',
        loadChildren: () =>
          import('./main/discover/discover.routes').then((m) => m.discoverRoutes),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/home' },
];
