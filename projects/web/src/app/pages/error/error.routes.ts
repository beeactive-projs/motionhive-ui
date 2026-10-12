import { Routes } from '@angular/router';

export const errorRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../layouts/guest-layout/guest-layout').then((m) => m.GuestLayout),
    children: [
      {
        path: 'server-error',
        loadComponent: () => import('./server-error/server-error').then((m) => m.ServerError),
        title: 'pageTitle.serverError',
      },
      {
        path: 'not-found',
        loadComponent: () => import('./not-found/not-found').then((m) => m.NotFound),
        title: 'pageTitle.pageNotFound',
      },
      {
        path: '',
        redirectTo: 'not-found',
        pathMatch: 'full',
      },
    ],
  },
];
