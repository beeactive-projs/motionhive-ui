import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
    title: 'Sign In - MotionHive',
  },
  {
    path: 'signup',
    loadComponent: () => import('./sign-up/sign-up.component').then((m) => m.SignUpComponent),
    title: 'Create Account - MotionHive',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'Reset Password - MotionHive',
  },
  {
    path: 'new-password',
    loadComponent: () =>
      import('./new-password/new-password.component').then((m) => m.NewPasswordComponent),
    title: 'New Password - MotionHive',
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
    title: 'Verify Email - MotionHive',
  },
  {
    path: 'facebook-callback',
    loadComponent: () =>
      import('./facebook-callback/facebook-callback.component').then(
        (m) => m.FacebookCallbackComponent,
      ),
    title: 'Facebook Sign In - MotionHive',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
