import { Routes } from '@angular/router';
import { guestGuard } from 'core';
import { AuthHero } from '../../layouts/auth-layout/auth-hero.model';

const HEROES = {
  login: {
    line1: 'auth.login.heroLine1',
    line2: 'auth.login.heroLine2',
    highlight: 'auth.login.heroHighlight',
    subtitle: 'auth.login.heroSubtitle',
  },
  signUp: {
    line1: 'auth.signUp.heroLine1',
    highlight: 'auth.signUp.heroHighlight',
    subtitle: 'auth.signUp.heroSubtitle',
  },
  resetPassword: {
    line1: 'auth.resetPassword.heroLine1',
    highlight: 'auth.resetPassword.heroHighlight',
    subtitle: 'auth.resetPassword.heroSubtitle',
  },
  newPassword: {
    line1: 'auth.newPassword.heroLine1',
    highlight: 'auth.newPassword.heroHighlight',
    subtitle: 'auth.newPassword.heroSubtitle',
  },
  verifyEmail: {
    line1: 'auth.verifyEmail.heroLine1',
    highlight: 'auth.verifyEmail.heroHighlight',
    subtitle: 'auth.verifyEmail.heroSubtitle',
  },
} satisfies Record<string, AuthHero>;

export const authRoutes: Routes = [
  {
    path: 'facebook-callback',
    loadComponent: () =>
      import('./facebook-callback/facebook-callback.component').then(
        (m) => m.FacebookCallbackComponent,
      ),
    title: 'pageTitle.facebookSignIn',
  },
  {
    path: '',
    loadComponent: () =>
      import('../../layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivateChild: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./login/login').then((m) => m.Login),
        title: 'pageTitle.signIn',
        data: { hero: HEROES.login },
      },
      {
        path: 'signup',
        loadComponent: () => import('./sign-up/sign-up').then((m) => m.SignUp),
        title: 'pageTitle.createAccount',
        data: { hero: HEROES.signUp },
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./reset-password/reset-password').then((m) => m.ResetPassword),
        title: 'pageTitle.resetPassword',
        data: { hero: HEROES.resetPassword },
      },
      {
        path: 'new-password',
        loadComponent: () => import('./new-password/new-password').then((m) => m.NewPassword),
        title: 'pageTitle.newPassword',
        data: { hero: HEROES.newPassword },
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./verify-email/verify-email').then((m) => m.VerifyEmail),
        title: 'pageTitle.verifyEmail',
        data: { hero: HEROES.verifyEmail },
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
];
