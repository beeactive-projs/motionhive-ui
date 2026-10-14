import { Routes } from '@angular/router';

/**
 * The trainee's Discover area, mounted at `/tabs/discover`. A coach reaches
 * the same pages from the menu page — the surface is role-agnostic.
 *
 * Every path keeps `discover` as the first segment after `/tabs` so the tab
 * stays lit on the pushed screens; session detail reuses the trainee
 * BookingDetail page in this stack so back returns to Discover, not to
 * My Sessions (the settled cross-surface rule: back returns to origin).
 */
export const discoverRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./discover').then((m) => m.Discover),
    title: 'pageTitle.discover',
  },
  {
    // Before `:id`, or the parameterised route swallows the word.
    path: 'coaches',
    loadComponent: () => import('./all-coaches/all-coaches').then((m) => m.AllCoaches),
    title: 'pageTitle.coaches',
  },
  {
    // A group seen from outside, pushed onto this stack so back returns to
    // the rail or the search it was opened from. Before `:id`, which would
    // otherwise read "group" as a session id.
    path: 'group/:groupId',
    loadComponent: () =>
      import('../groups/group-preview/group-preview').then((m) => m.GroupPreview),
    title: 'pageTitle.group',
  },
  {
    path: 'person/:handle',
    loadComponent: () => import('../person/person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('../user/sessions/booking-detail/booking-detail').then(
        (m) => m.BookingDetail,
      ),
    title: 'pageTitle.session',
  },
];
