import { Routes } from '@angular/router';

import { coachGuard } from '../../_shared/guards/coach.guard';
import { CoachStacks, clientTabRedirect } from '../clients/client-paths';
import { personRoutes } from '../person/person.routes';
import { programPageRoutes } from '../programs/program-pages.routes';

/**
 * Home and the screens it opens. The Needs you and Latest pages, a coach
 * in Your hive, a group, a post, the chat behind Needs you's "Message", a
 * client's page behind "Assign" and "Open" (and what that page opens), the
 * day's session or booking (or the whole day's when there are several), a
 * plan day's preview, a client's workout, a record's progress and the
 * workout behind it, Discover's coaches, groups and search, the invite
 * page, the coaching profile and the role switch open in this stack, so
 * back returns to Home instead of to a list the reader never came from
 * (`stack-paths.ts`, `clients/client-paths.ts`, `home-stack.config.ts`).
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
    // The coach's whole hive, from the Home hive card: every client as a
    // cell, a tap opens their sheet.
    path: 'hive',
    canActivate: [coachGuard],
    loadComponent: () => import('./client-hive/client-hive').then((m) => m.ClientHive),
    title: 'pageTitle.clientHive',
  },
  {
    // The trainee's month as a honeycomb, from the Home week card.
    path: 'month',
    loadComponent: () => import('./month-hive/month-hive').then((m) => m.MonthHive),
    title: 'pageTitle.monthHive',
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
    // The trainee's booking for today, from the Today row or the day's list.
    path: 'booking/:id',
    loadComponent: () =>
      import('../user/sessions/booking-detail/booking-detail').then((m) => m.BookingDetail),
    title: 'pageTitle.session',
  },
  {
    // The trainee's bookings, from the Today row on a day with several.
    path: 'bookings',
    loadComponent: () =>
      import('../user/sessions/my-sessions/my-sessions').then((m) => m.MySessions),
    title: 'pageTitle.mySessions',
  },
  {
    // The cancelled and declined ones, from the end of that list.
    path: 'bookings/cancelled',
    loadComponent: () =>
      import('../user/sessions/cancelled-bookings/cancelled-bookings').then(
        (m) => m.CancelledBookings,
      ),
    title: 'pageTitle.cancelledDeclined',
  },
  {
    // A plan day before it is started, from the week card. Start opens the
    // logger in the Workouts tab, where a live workout always runs.
    path: 'preview/:assignmentId',
    loadComponent: () => import('../workouts/preview/preview').then((m) => m.Preview),
    title: 'pageTitle.workout',
  },
  {
    // A finished workout, from a session on a record's progress.
    path: 'finish/:id',
    loadComponent: () => import('../workouts/finish/finish').then((m) => m.Finish),
    title: 'pageTitle.workoutComplete',
  },
  {
    // An exercise, from a preview. Ahead of the coach's pages below, which
    // mount the same page behind `coachGuard`, so a trainee reaches it too.
    path: 'exercise/:exerciseId',
    loadComponent: () =>
      import('../exercises/exercise-detail/exercise-detail').then((m) => m.ExerciseDetail),
    title: 'pageTitle.exercise',
  },
  {
    // Discover's coaches, from "Find a coach" (C1: Discover makes its rows
    // open in the stack it is mounted in).
    path: 'coaches',
    loadComponent: () =>
      import('../discover/all-coaches/all-coaches').then((m) => m.AllCoaches),
    title: 'pageTitle.coaches',
  },
  {
    // Discover's groups, from "Join a group". Not `groups`: the profile
    // routes below open a group under that word.
    path: 'groups-to-join',
    loadComponent: () => import('../discover/all-groups/all-groups').then((m) => m.AllGroups),
    title: 'pageTitle.groups',
  },
  {
    // Discover's search, from the header's search button (C2).
    path: 'search',
    loadComponent: () =>
      import('../discover/search/discover-search-page').then((m) => m.DiscoverSearchPage),
    title: 'pageTitle.search',
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
        // A session: the day's from the Today row or the agenda, or one from
        // a client's page.
        path: 'session/:id',
        loadComponent: () =>
          import('../coach/sessions/session-detail/session-detail').then((m) => m.SessionDetail),
        title: 'pageTitle.session',
      },
      {
        // The agenda, from the Today row on a day with several sessions.
        path: 'sessions',
        loadComponent: () => import('../coach/sessions/sessions').then((m) => m.Sessions),
        title: 'pageTitle.manageSessions',
      },
      {
        // The first week's "Invite clients".
        path: 'invite',
        loadComponent: () =>
          import('../clients/invite-client/invite-client').then((m) => m.InviteClient),
        title: 'pageTitle.inviteClient',
      },
      {
        // The first week's "Add your specialties".
        path: 'coaching',
        loadComponent: () =>
          import('../account/coaching-profile/coaching-profile').then((m) => m.CoachingProfile),
        title: 'pageTitle.coachingProfile',
      },
      {
        // The header's role pill.
        path: 'switch-role',
        loadComponent: () => import('../more/switch-role/switch-role').then((m) => m.SwitchRole),
      },
      {
        // The shortcuts' "New exercise"; Close and Save come back to Home.
        path: 'new-exercise',
        loadComponent: () =>
          import('../exercises/exercise-create/exercise-create').then((m) => m.ExerciseCreate),
        title: 'pageTitle.newExercise',
      },
      // A client's plan, from their page: the week grid, a day, who is on it.
      ...programPageRoutes,
    ],
  },
  ...personRoutes,
];
