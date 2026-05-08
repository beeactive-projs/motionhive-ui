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
    children: [
      {
        path: 'photo/:postId',
        loadComponent: () =>
          import('./photo-viewer/photo-viewer').then((m) => m.PhotoViewer),
        title: 'Photo - MotionHive',
      },
      {
        path: '',
        loadChildren: () => import('./main/main.routes').then((m) => m.mainRoutes),
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'error/not-found',
  },
];
