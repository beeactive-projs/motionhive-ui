import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';

/**
 * The Coaches screen, mounted at `/tabs/coaches`: the coach directory, and on
 * its Yours chip the reader's own coaches.
 *
 * A stack of its own, so its profiles are declared here rather than reusing
 * another stack's: back returns to the list they were opened from, which is
 * the settled cross-surface rule. `litTabId` lights Discover for it.
 */
export const coachesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./coaches').then((m) => m.Coaches),
    title: 'pageTitle.coaches',
  },
  // Before any parameterised route this area might gain.
  ...personRoutes,
];
