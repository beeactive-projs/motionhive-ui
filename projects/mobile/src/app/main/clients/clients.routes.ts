import { Routes } from '@angular/router';
import { personRoutes } from '../person/person.routes';
import { programPageRoutes } from '../programs/program-pages.routes';
import { CoachStacks, clientTabRedirect } from './client-paths';

/**
 * The coach's Clients area, mounted at `/tabs/clients` behind `coachGuard`.
 *
 * Every path keeps `clients` as the first segment after `/tabs` so the tab
 * stays lit on the pushed screens — same rule as sessions and messages.
 *
 * Notes, archive and a pending request are sheets driven from a page, not
 * routes: each is modal over the screen that opened it and needs that
 * screen's context when it closes. Requests have no page of their own; they
 * are the list's Requests chip (`?filter=requests`).
 *
 * Inviting used to be a sheet too, for the same reason, and it was the wrong
 * call: picking who to invite is a search over everyone, which wants a whole
 * screen and the keyboard on arrival, and it needs no context from the list
 * behind it. It is a page now, after `new-message` — which answers the same
 * kind of question about a different relationship.
 */
export const clientsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./clients').then((m) => m.Clients),
    title: 'pageTitle.clients',
  },
  {
    // Before `:clientId`, or the parameterised route reads "invite" as a
    // client id and the page 404s on a user that does not exist.
    path: 'invite',
    loadComponent: () => import('./invite-client/invite-client').then((m) => m.InviteClient),
    title: 'pageTitle.inviteClient',
  },
  // Someone's public profile, from the client page or a request, and the
  // chat and groups it opens. Before `:clientId`, or the parameterised
  // routes swallow "person".
  ...personRoutes,
  // A client's plan, opened from their page: the same pages the Programs
  // tab mounts, here so back returns to the client. Before `:clientId`.
  ...programPageRoutes,
  {
    // One exercise of the trainee's own Progress, read for one client, from
    // the Progress tab. Declared before `:clientId`.
    path: ':clientId/progress/:exerciseId',
    loadComponent: () =>
      import('../workouts/exercise-progress/exercise-progress').then((m) => m.ExerciseProgress),
    title: 'pageTitle.exerciseProgress',
  },
  // Training and Progress are tabs of the client page now; their old
  // addresses open it on that tab. Before `:clientId`, so the two-segment
  // paths are matched first.
  { path: ':clientId/progress', redirectTo: clientTabRedirect(CoachStacks.Clients, 'progress') },
  { path: ':clientId/training', redirectTo: clientTabRedirect(CoachStacks.Clients, 'training') },
  {
    // A session with this client, opened from their page. Here, not as a jump
    // to the Sessions tab, so back returns to the client.
    path: 'session/:id',
    loadComponent: () =>
      import('../coach/sessions/session-detail/session-detail').then((m) => m.SessionDetail),
    title: 'pageTitle.session',
  },
  {
    // One logged workout. Mounted here rather than under programs because it
    // is reached from the person, and switching tabs mid-review would lose
    // the client you were looking at.
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
