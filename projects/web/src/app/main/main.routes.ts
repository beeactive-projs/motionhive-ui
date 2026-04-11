import { Routes } from '@angular/router';
import {
  writerGuard,
  instructorGuard,
  participantGuard,
  roleRedirectGuard,
  superAdminGuard,
} from 'core';

export const mainRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./main').then((m) => m.Main),
    children: [
      // Shared — accessible to all authenticated users
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

      // Instructor section
      {
        path: 'dashboard',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'clients',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/clients/clients').then((m) => m.Clients),
        title: 'Clients - MotionHive',
      },
      {
        path: 'groups',
        canActivate: [instructorGuard],
        loadComponent: () => import('./instructor/groups/groups').then((m) => m.Groups),
        title: 'Groups - MotionHive',
      },
      {
        path: 'groups/:id',
        canActivate: [instructorGuard],
        loadComponent: () =>
          import('./instructor/groups/group-detail/group-detail').then((m) => m.GroupDetail),
        title: 'Group Details - MotionHive',
      },

      // User section
      {
        path: 'user/dashboard',
        canActivate: [participantGuard],
        loadComponent: () => import('./user/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'user/instructors',
        canActivate: [participantGuard],
        loadComponent: () => import('./user/instructors/instructors').then((m) => m.Instructors),
        title: 'My Instructors - MotionHive',
      },

      // Writer section
      {
        path: 'writer/posts',
        canActivate: [writerGuard],
        loadComponent: () => import('./writer/posts/posts').then((m) => m.Posts),
        title: 'Posts - MotionHive',
      },
      {
        path: 'writer/posts/new',
        canActivate: [writerGuard],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'New Post - MotionHive',
      },
      {
        path: 'writer/posts/:slug',
        canActivate: [writerGuard],
        loadComponent: () =>
          import('./writer/posts/post-detail/post-detail').then((m) => m.PostDetail),
        title: 'Edit Post - MotionHive',
      },

      // Super-admin section
      {
        path: 'super-admin/dashboard',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard - MotionHive',
      },
      {
        path: 'super-admin/users',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/users/users').then((m) => m.Users),
        title: 'Users - MotionHive',
      },
      {
        path: 'super-admin/groups',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./super-admin/groups/groups').then((m) => m.Groups),
        title: 'Groups - MotionHive',
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
