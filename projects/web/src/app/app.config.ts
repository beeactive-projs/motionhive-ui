import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideSignalFormsConfig } from '@angular/forms/signals';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';

import {
  authInterceptor,
  languageInterceptor,
  environment,
  errorInterceptor,
  isFieldInvalid,
  loadingInterceptor,
  provideAppI18n,
} from 'core';

import { routes } from './app.routes';
import { MotionHiveLara } from '../../../core/src/styles/styles.primeng';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(
      withXhr(),
      withInterceptors([
        languageInterceptor,
        authInterceptor,
        errorInterceptor,
        loadingInterceptor,
      ]),
    ),
    provideAppI18n(),
    provideSignalFormsConfig({
      classes: {
        // PrimeNG's invalid style on Signal Forms fields, shown on blur like
        // the field's message (inputs can't take [invalid] next to [formField]).
        'p-invalid': ({ state }) => isFieldInvalid(state()),
      },
    }),
    providePrimeNG({
      theme: {
        preset: MotionHiveLara,
        options: {
          darkModeSelector: '.dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
      license: environment.primeUiLicenseKey,
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
