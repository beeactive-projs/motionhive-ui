import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'join/:token',
    loadComponent: () => import('./join-group/join-group').then((m) => m.JoinGroup),
    title: 'Join Group - BeeActive',
  },
  {
    path: 'client',
    loadChildren: () => import('./client/client.routes').then((m) => m.clientRoutes),
  },
  {
    path: '',
    loadChildren: () => import('./instructor/instructor.routes').then((m) => m.instructorRoutes),
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile').then((m) => m.Profile),
    title: 'My Profile - BeeActive',
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
