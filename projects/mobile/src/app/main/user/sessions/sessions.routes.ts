import { Routes } from '@angular/router';

/**
 * The trainee's sessions area, mounted at `/tabs/user/sessions`.
 *
 * Every path keeps `user` as the first segment after `/tabs` so the tab stays
 * lit on the pushed screens — same rule as messages and the coach area.
 *
 * The booking-outcome and cancel confirmations are sheets driven from the
 * detail page, not routes: both are modal over the screen that opened them.
 */
export const userSessionsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./my-sessions/my-sessions').then((m) => m.MySessions),
    title: 'pageTitle.mySessions',
  },
  {
    // Before `:id`, or the parameterised route swallows the word.
    path: 'cancelled',
    loadComponent: () =>
      import('./cancelled-bookings/cancelled-bookings').then(
        (m) => m.CancelledBookings,
      ),
    title: 'pageTitle.cancelledDeclined',
  },
  {
    path: 'person/:handle',
    loadComponent: () => import('../../person/person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./booking-detail/booking-detail').then((m) => m.BookingDetail),
    title: 'pageTitle.session',
  },
];
