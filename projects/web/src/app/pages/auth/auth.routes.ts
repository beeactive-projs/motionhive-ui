import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
    title: 'pageTitle.signIn',
  },
  {
    path: 'signup',
    loadComponent: () => import('./sign-up/sign-up.component').then((m) => m.SignUpComponent),
    title: 'pageTitle.createAccount',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'pageTitle.resetPassword',
  },
  {
    path: 'new-password',
    loadComponent: () =>
      import('./new-password/new-password.component').then((m) => m.NewPasswordComponent),
    title: 'pageTitle.newPassword',
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
    title: 'pageTitle.verifyEmail',
  },
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
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
