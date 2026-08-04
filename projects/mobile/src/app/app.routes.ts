import { Routes } from '@angular/router';
import { authGuard } from 'core';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/tabs/tabs').then((m) => m.Tabs),
    children: [
      {
        path: 'clients',
        loadComponent: () => import('./main/clients/clients').then((m) => m.Clients),
      },
      {
        path: 'requests',
        loadComponent: () => import('./main/requests/requests').then((m) => m.Requests),
      },
      {
        path: 'settings',
        loadComponent: () => import('./main/settings/settings').then((m) => m.Settings),
      },
      { path: '', redirectTo: 'clients', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs/clients', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/clients' },
];
