import { Routes } from '@angular/router';

export const errorRoutes: Routes = [
  {
    path: 'server-error',
    loadComponent: () =>
      import('./server-error/server-error.component').then((m) => m.ServerErrorComponent),
    title: 'pageTitle.serverError',
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'pageTitle.pageNotFound',
  },
  {
    path: '',
    redirectTo: 'not-found',
    pathMatch: 'full',
  },
];
