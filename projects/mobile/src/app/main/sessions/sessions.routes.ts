import { Routes } from '@angular/router';

/**
 * The sessions area at `/tabs/sessions`, for both roles.
 *
 * The list and the detail load a shell that renders the coach's screen or the
 * trainee's depending on the active mode — see `SessionsShell` for why that is
 * a component and not a route guard.
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
    loadComponent: () =>
      import('../sessions-shell/sessions-shell').then((m) => m.SessionsShell),
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
      import('../sessions-shell/session-detail-shell').then((m) => m.SessionDetailShell),
    title: 'Session - MotionHive',
  },
];
