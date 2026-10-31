import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';

/**
 * The Discover tab, mounted at `/tabs/discover` in both modes: the surface
 * is role-agnostic.
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
    // Search: coaches, groups and sessions. Home mounts the same screen at
    // `/tabs/home/search`; its rows open in whichever stack it is in.
    // Before `:id`, or the parameterised route swallows the word.
    path: 'search',
    loadComponent: () =>
      import('./search/discover-search-page').then((m) => m.DiscoverSearchPage),
    title: 'pageTitle.search',
  },
  {
    // Before `:id`, or the parameterised route swallows the word. Home
    // mounts it too, at `/tabs/home/coaches`.
    path: 'coaches',
    loadComponent: () => import('./all-coaches/all-coaches').then((m) => m.AllCoaches),
    title: 'pageTitle.coaches',
  },
  {
    // Every group to join (Home mounts it at `/tabs/home/groups-to-join`).
    // Exact, and before the profile routes, whose
    // `groups/` children (a group opened from a profile) start with the same
    // word but never match it alone.
    path: 'groups',
    pathMatch: 'full',
    loadComponent: () => import('./all-groups/all-groups').then((m) => m.AllGroups),
    title: 'pageTitle.groups',
  },
  {
    // A group seen from outside, pushed onto this stack so back returns to
    // the tab, the list or the search it was opened from. Before `:id`,
    // which would otherwise read "group" as a session id.
    path: 'group/:groupId',
    loadComponent: () =>
      import('../groups/group-preview/group-preview').then((m) => m.GroupPreview),
    title: 'pageTitle.group',
  },
  ...personRoutes,
  {
    path: ':id',
    loadComponent: () =>
      import('../user/sessions/booking-detail/booking-detail').then(
        (m) => m.BookingDetail,
      ),
    title: 'pageTitle.session',
  },
];
