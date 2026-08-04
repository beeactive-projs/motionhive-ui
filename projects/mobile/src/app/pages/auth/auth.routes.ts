import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    title: 'Sign in - MotionHive',
  },
  {
    path: 'signup',
    loadComponent: () => import('./sign-up/sign-up').then((m) => m.SignUp),
    title: 'Create account - MotionHive',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
    title: 'Reset password - MotionHive',
  },
  {
    path: 'new-password',
    loadComponent: () => import('./new-password/new-password').then((m) => m.NewPassword),
    title: 'New password - MotionHive',
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./verify-email/verify-email').then((m) => m.VerifyEmail),
    title: 'Verify email - MotionHive',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
