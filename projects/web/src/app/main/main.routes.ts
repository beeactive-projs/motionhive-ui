import { Routes } from '@angular/router';
import { rolesGuard, instructorGuard, roleRedirectGuard, superAdminGuard, UserRoles } from 'core';

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
        path: 'join/:token',
        loadComponent: () => import('./join-group/join-group').then((m) => m.JoinGroup),
        title: 'Join Group - MotionHive',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile),
        title: 'My Profile - MotionHive',
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
