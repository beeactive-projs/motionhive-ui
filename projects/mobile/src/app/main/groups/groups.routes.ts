import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';
import { groupPageRoutes } from './group-pages.routes';

/**
 * The Groups area, mounted at `/tabs/groups`.
 *
 * No guard: groups are the one shared surface. A coach owns and moderates
 * them, a trainee joins and posts in them, and both read the same screens —
 * what differs is which controls appear, which `groups.config.ts` answers
 * per group from the viewer's membership role.
 *
 * Every path keeps `groups` as the first segment after `/tabs` so the tab
 * stays lit on pushed screens, same rule as clients and sessions.
 *
 * The composer, the member sheet and the group's own settings are sheets
 * driven from a page rather than routes: each is modal over the screen that
 * opened it and needs that screen's context when it closes.
 */
export const groupsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./groups').then((m) => m.Groups),
    title: 'pageTitle.groups',
  },
  // Someone named in a group: a member, a post's author, a commenter.
  // Before the group pages, or `:groupId` swallows the word.
  ...personRoutes,
  ...groupPageRoutes,
];
