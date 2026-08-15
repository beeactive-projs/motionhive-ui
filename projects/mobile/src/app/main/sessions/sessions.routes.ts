import { Routes } from '@angular/router';

/**
 * The sessions area, mounted at `/tabs/sessions` behind `coachGuard`.
 *
 * Every path keeps `sessions` as the first segment after `/tabs` so the tab
 * stays lit on the detail screen — same rule as messages.
 *
 * Create and cancel are sheets driven from a page, not routes: both are modal
 * over the screen that opened them, and both need that screen's context when
 * they close.
 */
export const sessionsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./sessions').then((m) => m.Sessions),
    title: 'Sessions - MotionHive',
  },
  {
    // Before `:id`, or the parameterised route swallows "person".
    path: 'person/:handle',
    loadComponent: () => import('../person/person').then((m) => m.Person),
    title: 'Profile - MotionHive',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./session-detail/session-detail').then((m) => m.SessionDetail),
    title: 'Session - MotionHive',
  },
];
