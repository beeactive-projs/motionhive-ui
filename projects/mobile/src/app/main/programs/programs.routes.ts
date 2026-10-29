import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';
import { CoachStacks, clientTabRedirect } from '../clients/client-paths';
import { programPageRoutes } from './program-pages.routes';

/**
 * The coach's authoring area, mounted at `/tabs/programs`.
 *
 * Routines open the round-1 builder — the same screen the trainee authors in,
 * because a routine is a routine whoever wrote it. Programs get the week grid,
 * and a day inside one opens that same builder again with a week·day context.
 *
 * Who needs attention is not here: that is the Clients tab's triage lens, and
 * a second roster under programs was the same list with a different colour
 * map. A client's own training and a logged workout mount under clients for
 * the same reason — they are reached from the person.
 */
export const programRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./programs').then((m) => m.Programs),
    title: 'pageTitle.programs',
  },
  {
    path: 'routine/:id',
    loadComponent: () =>
      import('../workouts/routine-builder/routine-builder').then((m) => m.RoutineBuilder),
    title: 'pageTitle.routine',
  },
  // A client, opened from a plan's list of who is on it — the same screens
  // the Clients tab mounts, pushed onto THIS stack so back returns to the
  // plan. See `clients/client-paths.ts`.
  // Training and Progress are tabs of the client page now; their old
  // addresses open it on that tab.
  {
    path: 'client/:clientId/training',
    redirectTo: clientTabRedirect(CoachStacks.Programs, 'training'),
  },
  {
    path: 'client/:clientId/progress/:exerciseId',
    loadComponent: () =>
      import('../workouts/exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  {
    path: 'client/:clientId/progress',
    redirectTo: clientTabRedirect(CoachStacks.Programs, 'progress'),
  },
  {
    path: 'client/:clientId',
    loadComponent: () =>
      import('../clients/client-detail/client-detail').then((m) => m.ClientDetail),
    title: 'pageTitle.client',
  },
  {
    // A session with a client, from their page in this stack; back returns there.
    path: 'session/:id',
    loadComponent: () =>
      import('../coach/sessions/session-detail/session-detail').then((m) => m.SessionDetail),
    title: 'pageTitle.session',
  },
  {
    path: 'log/:id',
    loadComponent: () => import('./log-review/log-review').then((m) => m.LogReview),
    title: 'pageTitle.workout',
  },
  ...personRoutes,
  ...programPageRoutes,
];
