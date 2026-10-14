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
    title: 'pageTitle.clients',
  },
  {
    // Before `:clientId`, or the parameterised route swallows the word.
    path: 'requests',
    loadComponent: () => import('./requests/requests').then((m) => m.Requests),
    title: 'pageTitle.requests',
  },
  {
    // Someone's public profile, from the client page or a request. Before
    // `:clientId`, or the parameterised routes swallow "person".
    path: 'person/:handle',
    loadComponent: () => import('../person/person').then((m) => m.Person),
    title: 'pageTitle.profile',
  },
  {
    // The trainee's own Progress screens, read for one client. Same reason as
    // training below for living here, and declared before `:clientId`.
    path: ':clientId/progress/:exerciseId',
    loadComponent: () =>
      import('../workouts/exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  {
    path: ':clientId/progress',
    loadComponent: () => import('../workouts/progress/progress').then((m) => m.Progress),
    title: 'pageTitle.progress',
  },
  {
    // A client's training and one logged workout. Mounted here rather than
    // under programs because they are reached from the person, and switching
    // tabs mid-review would lose the client you were looking at.
    //
    // `:clientId/training`, not `client/:clientId/training`: the detail route
    // below is `:clientId`, and a stray literal segment in one of the two
    // shapes is what deep links and guards get wrong. Declared before
    // `:clientId` so the two-segment path is matched first.
    path: ':clientId/training',
    loadComponent: () =>
      import('../programs/client-training/client-training').then((m) => m.ClientTraining),
    title: 'pageTitle.training',
  },
  {
    path: 'log/:id',
    loadComponent: () =>
      import('../programs/log-review/log-review').then((m) => m.LogReview),
    title: 'pageTitle.workout',
  },
  {
    // The client's user id, not the relationship id — it is what every
    // client endpoint keys on.
    path: ':clientId',
    loadComponent: () =>
      import('./client-detail/client-detail').then((m) => m.ClientDetail),
    title: 'pageTitle.client',
  },
];
