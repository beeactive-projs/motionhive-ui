import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';
import { CoachStacks, clientTabRedirect } from '../clients/client-paths';
import { personRoutes } from '../person/person.routes';
import { programPageRoutes } from '../programs/program-pages.routes';

/**
 * Home and the screens it opens. The Needs you and Latest pages, a coach
 * in Your hive, a group, a post, the chat behind Needs you's "Message", a
 * client's page behind "Assign" and "Open" (and what that page opens), the
 * day's session or booking, a client's workout and a record's progress open
 * in this stack, so back returns to Home instead of to a list the reader
 * never came from (`stack-paths.ts`, `clients/client-paths.ts`).
 */
export const homeRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home').then((m) => m.Home),
  },
  {
    // Everyone who needs the coach, grouped by reason, from "Show more".
    path: 'needs-you',
    canActivate: [coachGuard],
    loadComponent: () => import('./needs-you/needs-you').then((m) => m.NeedsYou),
    title: 'pageTitle.needsYou',
  },
  {
    // The last two weeks by day, from Latest's "See all"; either side's.
    path: 'latest',
    loadComponent: () => import('./latest/latest').then((m) => m.Latest),
    title: 'pageTitle.latest',
  },
  {
    // A client's workout, read as their coach (`LogReview`), from Latest or
    // from a client's page in this stack.
    path: 'log/:id',
    canActivate: [coachGuard],
    loadComponent: () =>
      import('../programs/log-review/log-review').then((m) => m.LogReview),
    title: 'pageTitle.workout',
  },
  {
    // A record's exercise, the trainee's own progress, from Latest.
    path: 'progress/:exerciseId',
    loadComponent: () =>
      import('../workouts/exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  {
    // The trainee's booking for today, from the Today row.
    path: 'booking/:id',
    loadComponent: () =>
      import('../user/sessions/booking-detail/booking-detail').then((m) => m.BookingDetail),
    title: 'pageTitle.session',
  },
  {
    // The coach's side: a client from Needs you, the same screens the
    // Clients and Programs tabs mount for one, and the day's session.
    path: '',
    canActivateChild: [coachGuard],
    children: [
      // Training and Progress are tabs of the client page now; their old
      // addresses open it on that tab.
      {
        path: 'client/:clientId/training',
        pathMatch: 'full',
        redirectTo: clientTabRedirect(CoachStacks.Home, 'training'),
      },
      {
        // One exercise of a client's Progress, from the client page's tab.
        path: 'client/:clientId/progress/:exerciseId',
        loadComponent: () =>
          import('../workouts/exercise-progress/exercise-progress').then(
            (m) => m.ExerciseProgress,
          ),
        title: 'pageTitle.exerciseProgress',
      },
      {
        path: 'client/:clientId/progress',
        pathMatch: 'full',
        redirectTo: clientTabRedirect(CoachStacks.Home, 'progress'),
      },
      {
        path: 'client/:clientId',
        loadComponent: () =>
          import('../clients/client-detail/client-detail').then((m) => m.ClientDetail),
        title: 'pageTitle.client',
      },
      {
        // A session: the day's from the Today row, or one from a client's page.
        path: 'session/:id',
        loadComponent: () =>
          import('../coach/sessions/session-detail/session-detail').then((m) => m.SessionDetail),
        title: 'pageTitle.session',
      },
      // A client's plan, from their page: the week grid, a day, who is on it.
      ...programPageRoutes,
    ],
  },
  ...personRoutes,
];
