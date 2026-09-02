import { Routes } from '@angular/router';

/**
 * The coach's Clients area, mounted at `/tabs/clients` behind `coachGuard`.
 *
 * Every path keeps `clients` as the first segment after `/tabs` so the tab
 * stays lit on the pushed screens — same rule as sessions and messages.
 *
 * Invite, notes and archive are sheets driven from a page, not routes: each
 * is modal over the screen that opened it and needs that screen's context
 * when it closes.
 */
export const clientsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./clients').then((m) => m.Clients),
    title: 'Clients - MotionHive',
  },
  {
    // Before `:clientId`, or the parameterised route swallows the word.
    path: 'requests',
    loadComponent: () => import('./requests/requests').then((m) => m.Requests),
    title: 'Requests - MotionHive',
  },
  {
    // The client's user id, not the relationship id — it is what every
    // client endpoint keys on.
    path: ':clientId',
    loadComponent: () =>
      import('./client-detail/client-detail').then((m) => m.ClientDetail),
    title: 'Client - MotionHive',
  },
];
