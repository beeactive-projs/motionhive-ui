import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    title: 'pageTitle.signIn',
  },
  {
    path: 'signup',
    loadComponent: () => import('./sign-up/sign-up').then((m) => m.SignUp),
    title: 'pageTitle.createAccount',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
    title: 'pageTitle.resetPassword',
  },
  {
    path: 'new-password',
    loadComponent: () => import('./new-password/new-password').then((m) => m.NewPassword),
    title: 'pageTitle.newPassword',
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./verify-email/verify-email').then((m) => m.VerifyEmail),
    title: 'pageTitle.verifyEmail',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
