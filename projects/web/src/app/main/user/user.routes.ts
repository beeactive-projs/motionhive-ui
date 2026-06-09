import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';

export const userRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard - MotionHive',
  },
  {
    // Legacy path. Coaches now live in the profile "Coaches" tab.
    path: 'instructors',
    canActivate: [
      (): UrlTree =>
        inject(Router).createUrlTree(['/profile'], { queryParams: { tab: 'coaches' } }),
    ],
    children: [],
  },
  {
    path: 'sessions',
    loadComponent: () => import('./my-sessions/my-sessions').then((m) => m.MySessions),
    title: 'My sessions - MotionHive',
  },
  {
    path: 'sessions/discover',
    loadComponent: () =>
      import('./my-sessions/sessions-discover/sessions-discover').then(
        (m) => m.SessionsDiscover,
      ),
    title: 'Discover sessions - MotionHive',
  },
  {
    // Day-of online countdown. Declared before `sessions/:id` so the
    // `/join` suffix wins; `sessions/discover` above already wins over `:id`.
    path: 'sessions/:id/join',
    loadComponent: () =>
      import('../session-day-of-online/session-day-of-online').then(
        (m) => m.SessionDayOfOnline,
      ),
    title: 'Join session - MotionHive',
  },
  {
    // Public session showcase (reached from Discover, share links, reminders).
    path: 'sessions/:id',
    loadComponent: () =>
      import('./my-sessions/session-showcase/session-showcase').then(
        (m) => m.SessionShowcase,
      ),
    title: 'Session - MotionHive',
  },
];
