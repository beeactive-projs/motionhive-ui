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
        path: 'writer',
        canActivate: [rolesGuard(UserRoles.SuperAdmin, UserRoles.Writer)],
        loadChildren: () => import('./writer/writer.routes').then((m) => m.writerRoutes),
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
