import { Routes } from '@angular/router';
import { guestGuard } from 'core';

export const authRoutes: Routes = [
  {
    // Signed-in users skip these pages (to /tabs/home, see APP_HOME_URL);
    // links carrying a `token` (reset, verify) still open.
    path: '',
    canActivateChild: [guestGuard],
    children: [
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
        loadComponent: () =>
          import('./reset-password/reset-password').then((m) => m.ResetPassword),
        title: 'pageTitle.resetPassword',
      },
      {
        path: 'new-password',
        loadComponent: () => import('./new-password/new-password').then((m) => m.NewPassword),
        title: 'pageTitle.newPassword',
      },
      {
        // After confirming an account deletion: signed out, with the date.
        path: 'account-closed',
        loadComponent: () =>
          import('./account-closed/account-closed').then((m) => m.AccountClosed),
        title: 'pageTitle.accountClosed',
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
    ],
  },
];
