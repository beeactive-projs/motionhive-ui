import { Routes } from '@angular/router';

/**
 * The trainee's coaches area, mounted at `/tabs/more/coaches`.
 *
 * It hangs off `more` so the Menu tab stays lit on the way in and on the
 * profile pushed from it — `activeTabIdFromUrl` reads the segment right
 * after `/tabs`. The profile is declared here rather than reusing another
 * stack's so back returns to the coaches list it was opened from, which is
 * the settled cross-surface rule.
 */
export const coachesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./coaches').then((m) => m.Coaches),
    title: 'pageTitle.myCoaches',
  },
  {
    // Before any parameterised route this area might gain.
    path: 'person/:handle',
    loadComponent: () => import('../person/person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
];
