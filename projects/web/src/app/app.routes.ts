import { Routes } from '@angular/router';
import { authGuard } from 'core';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'error',
    loadChildren: () => import('./pages/error/error.routes').then((m) => m.errorRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./main/main.routes').then((m) => m.appRoutes),
  },
  {
    path: '**',
    redirectTo: 'error/not-found',
  },
];
