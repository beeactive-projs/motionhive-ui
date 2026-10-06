import { Routes } from '@angular/router';

export const legalRoutes: Routes = [
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./terms-of-service/terms-of-service.component').then(
        (m) => m.TermsOfServiceComponent
      ),
    title: 'Terms and Conditions | MotionHive',
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent),
    title: 'Privacy Policy | MotionHive',
  },
  {
    path: 'cookie-policy',
    loadComponent: () =>
      import('./cookie-policy/cookie-policy.component').then((m) => m.CookiePolicyComponent),
    title: 'Cookie Policy | MotionHive',
  },
  {
    path: 'delete-account',
    loadComponent: () =>
      import('./delete-account/delete-account.component').then((m) => m.DeleteAccountComponent),
    title: 'Delete Your Account | MotionHive',
  },
  {
    path: '',
    redirectTo: 'terms-of-service',
    pathMatch: 'full',
  },
];
