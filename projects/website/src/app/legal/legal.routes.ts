import { Routes } from '@angular/router';

export const legalRoutes: Routes = [
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./terms-of-service/terms-of-service.component').then(
        (m) => m.TermsOfServiceComponent
      ),
    title: 'Terms of Service - BeeActive',
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent),
    title: 'Privacy Policy - BeeActive',
  },
  {
    path: '',
    redirectTo: 'terms-of-service',
    pathMatch: 'full',
  },
];
