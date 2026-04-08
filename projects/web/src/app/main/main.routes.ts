import { Routes } from '@angular/router';
import { instructorGuard, superAdminGuard } from 'core';

export const appRoutes: Routes = [
  {
    path: 'join/:token',
    loadComponent: () => import('./join-group/join-group').then((m) => m.JoinGroup),
    title: 'Join Group - MotionHive',
  },
  {
    path: 'client',
    loadChildren: () => import('./client/client.routes').then((m) => m.clientRoutes),
  },
  {
    path: '',
    canActivate: [instructorGuard],
    loadChildren: () => import('./instructor/instructor.routes').then((m) => m.instructorRoutes),
  },
  {
    path: 'super-admin',
    canActivate: [superAdminGuard],
    loadChildren: () => import('./super-admin/super-admin.routes').then((m) => m.superAdminRoutes),
  },
  // {
  //   path: 'profile',
  //   loadComponent: () => import('./profile/profile').then((m) => m.Profile),
  //   title: 'My Profile - MotionHive',
  // },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
