import { Routes } from '@angular/router';
import { rolesGuard, instructorGuard, roleRedirectGuard, UserRoles } from 'core';
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
        // Unified discovery hub — coaches, sessions, groups in one place.
        path: 'discover',
        loadComponent: () => import('./discover/discover').then((m) => m.Discover),
        title: 'Discover - MotionHive',
      },
      {
        // Exercise catalog — browsable by everyone (clients build their own
        // workouts/routines from it). Authoring is gated to instructors
        // inside the component. Instructors also reach it via /coaching/exercises.
        path: 'exercises',
        loadComponent: () => import('./instructor/exercises/exercises').then((m) => m.Exercises),
        title: 'Exercises - MotionHive',
      },
      {
        path: 'messages',
        loadChildren: () => import('./messages/messages.routes').then((m) => m.messagesRoutes),
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
      // Discover sessions now lives in the user area
      // (/user/sessions/discover). Keep the legacy path redirecting; it
      // must stay declared before `sessions/:id` so it wins over the
      // showcase wildcard.
      { path: 'sessions/discover', redirectTo: 'user/sessions/discover', pathMatch: 'full' },
      // My sessions now lives in the user area — see `userRoutes`
      // (/user/sessions). Legacy paths are redirected below.
      // Notification producers emit `screen: 'sessions/my'` (BE convention
      // since the API surface is /sessions/my); older FE links used
      // /my/sessions. The page now lives under the user area, so forward
      // both legacy paths to the canonical route to avoid 404s. `sessions/my`
      // must precede `sessions/:id` below so it wins over the showcase wildcard
      // (otherwise it resolves to `/user/sessions/my` and the showcase rejects
      // the non-UUID id with "that session link looks invalid").
      { path: 'sessions/my', redirectTo: 'user/sessions', pathMatch: 'full' },
      { path: 'my/sessions', redirectTo: 'user/sessions', pathMatch: 'full' },
      // Session showcase + day-of join now live under the user area
      // (/user/sessions/:id, see `userRoutes`). Redirect the legacy /
      // externally-shared paths (email reminders, share links) so they
      // don't 404. `:id/join` must precede `:id` so the /join suffix wins.
      { path: 'sessions/:id/join', redirectTo: 'user/sessions/:id/join', pathMatch: 'full' },
      { path: 'sessions/:id', redirectTo: 'user/sessions/:id', pathMatch: 'full' },
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
