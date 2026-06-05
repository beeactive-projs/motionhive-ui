import { Routes } from '@angular/router';
import { rolesGuard, instructorGuard, roleRedirectGuard, superAdminGuard, UserRoles } from 'core';
import { handleMatcher } from '../pages/public-profile/handle-matcher';

export const mainRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./main').then((m) => m.Main),
    children: [
      // Shared — accessible to all authenticated users
      {
        path: 'home',
        loadComponent: () => import('./home/home').then((m) => m.Home),
        title: 'Home - MotionHive',
      },
      {
        path: 'explore',
        loadComponent: () => import('./explore/explore').then((m) => m.Explore),
        title: 'Explore - MotionHive',
      },
      {
        // Unified discovery hub — coaches, sessions, groups in one place.
        path: 'discover',
        loadComponent: () => import('./discover/discover').then((m) => m.Discover),
        title: 'Discover - MotionHive',
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./messages/messages.routes').then((m) => m.messagesRoutes),
      },
      {
        path: 'join/:token',
        loadComponent: () => import('./join-group/join-group').then((m) => m.JoinGroup),
        title: 'Join Group - MotionHive',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile),
        title: 'My Profile - MotionHive',
      },
      // Phase E — client-facing session surfaces.
      {
        path: 'sessions/discover',
        loadComponent: () =>
          import('./sessions-discover/sessions-discover').then(
            (m) => m.SessionsDiscover,
          ),
        title: 'Discover sessions - MotionHive',
      },
      {
        path: 'my/sessions',
        loadComponent: () =>
          import('./sessions-my/sessions-my').then((m) => m.SessionsMy),
        title: 'My sessions - MotionHive',
      },
      // ── Client workouts area (re-skinned against Claude Design output) ──
      {
        path: 'my/plans',
        loadComponent: () =>
          import('./client-plans/client-plans-list/client-plans-list').then(
            (m) => m.ClientPlansList,
          ),
        title: 'My plans - MotionHive',
      },
      {
        path: 'my/plans/:id',
        loadComponent: () =>
          import('./client-plans/client-plan-detail/client-plan-detail').then(
            (m) => m.ClientPlanDetail,
          ),
        title: 'My plan - MotionHive',
      },
      {
        path: 'my/workouts',
        loadComponent: () =>
          import('./client-workouts/client-workouts-history/client-workouts-history').then(
            (m) => m.ClientWorkoutsHistory,
          ),
        title: 'Workout history - MotionHive',
      },
      {
        path: 'my/workouts/:id/complete',
        loadComponent: () =>
          import('./client-workouts/workout-complete/workout-complete').then(
            (m) => m.WorkoutComplete,
          ),
        title: 'Workout complete - MotionHive',
      },
      {
        path: 'my/workout-log/:id',
        loadComponent: () =>
          import('./client-workouts/workout-log-active/workout-log-active').then(
            (m) => m.WorkoutLogActive,
          ),
        title: 'Workout - MotionHive',
      },
      {
        // Read-only replay — used by client history + coach (with ?coach=1)
        path: 'my/workout-log/:id/replay',
        loadComponent: () =>
          import('./client-workouts/workout-log-replay/workout-log-replay').then(
            (m) => m.WorkoutLogReplay,
          ),
        title: 'Workout replay - MotionHive',
      },
      // Notification producers emit `screen: 'sessions/my'` (BE convention
      // since the API surface is /sessions/my). Forward to the canonical
      // FE route so deep-links from emails / push don't 404.
      { path: 'sessions/my', redirectTo: 'my/sessions', pathMatch: 'full' },
      {
        // Day-of online countdown — the screen reminders link to 10 min
        // before start. Must be declared BEFORE `sessions/:id` so the
        // `/join` suffix wins.
        path: 'sessions/:id/join',
        loadComponent: () =>
          import('./session-day-of-online/session-day-of-online').then(
            (m) => m.SessionDayOfOnline,
          ),
        title: 'Join session - MotionHive',
      },
      {
        // Public session showcase. Order matters: `sessions/discover` +
        // `sessions/my` are declared above so they always match before `:id`.
        path: 'sessions/:id',
        loadComponent: () =>
          import('./session-showcase/session-showcase').then(
            (m) => m.SessionShowcase,
          ),
        title: 'Session - MotionHive',
      },
      {
        path: 'groups',
        loadComponent: () => import('./groups/groups').then((m) => m.GroupsLayout),
        title: 'Groups - MotionHive',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'feed' },
          {
            path: 'feed',
            loadComponent: () =>
              import('./groups/groups-feed/groups-feed').then((m) => m.GroupsFeed),
            title: 'Feed - MotionHive',
          },
          {
            path: 'discover',
            loadComponent: () =>
              import('./groups/groups-discover/groups-discover').then((m) => m.GroupsDiscover),
            title: 'Discover groups - MotionHive',
          },
          {
            path: 'your-groups',
            loadComponent: () =>
              import('./groups/your-groups/your-groups').then((m) => m.YourGroups),
            title: 'Your groups - MotionHive',
          },
          {
            path: 'preview/:id',
            loadComponent: () =>
              import('./groups/group-preview/group-preview').then((m) => m.GroupPreview),
            title: 'Group preview - MotionHive',
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./groups/group-detail/group-detail').then((m) => m.GroupDetail),
            title: 'Group details - MotionHive',
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'posts' },
              {
                path: 'posts',
                loadComponent: () =>
                  import('./groups/group-detail/tabs/posts-tab/posts-tab').then((m) => m.PostsTab),
              },
              {
                path: 'members',
                loadComponent: () =>
                  import('./groups/group-detail/tabs/members-tab/members-tab').then(
                    (m) => m.MembersTab,
                  ),
              },
              {
                path: 'about',
                loadComponent: () =>
                  import('./groups/group-detail/tabs/about-tab/about-tab').then((m) => m.AboutTab),
              },
            ],
          },
        ],
      },
      {
        path: 'profile/invoices/:id',
        loadComponent: () =>
          import('./user/payments/invoice-detail/invoice-detail').then((m) => m.UserInvoiceDetail),
        title: 'Invoice - MotionHive',
      },

      // Public instructor profile (`/@<handle>`)
      {
        matcher: handleMatcher,
        loadChildren: () =>
          import('./public-profile/public-profile.routes').then((m) => m.publicProfileRoutes),
      },

      // Instructor
      {
        path: 'coaching',
        canActivate: [instructorGuard],
        loadChildren: () =>
          import('./instructor/instructor.routes').then((m) => m.instructorRoutes),
      },

      // Activity (any authenticated user)
      {
        path: 'activity',
        loadChildren: () => import('./user/activity.routes').then((m) => m.activityRoutes),
      },

      // User
      {
        path: 'user',
        // canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.User)],
        loadChildren: () => import('./user/user.routes').then((m) => m.userRoutes),
      },

      // Writer
      {
        path: 'writer/posts',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () => import('./writer/posts/posts').then((m) => m.Posts),
        title: 'Posts - MotionHive',
      },
      {
        path: 'writer/posts/new',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'New Post - MotionHive',
      },
      {
        path: 'writer/posts/:id',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Admin, UserRoles.Writer)],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'Edit Post - MotionHive',
      },

      // Super-admin
      {
        path: 'super-admin',
        canActivate: [superAdminGuard],
        loadChildren: () =>
          import('./super-admin/super-admin.routes').then((m) => m.superAdminRoutes),
      },

      // Role-aware default redirect
      {
        path: '',
        pathMatch: 'full',
        canActivate: [roleRedirectGuard],
        children: [],
      },
    ],
  },
];
