import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { MotionHiveLara } from '../../../core/src/styles/styles.primeng';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // withFetch(): use the Fetch API so HttpClient works during prerender (Node
    // has no XMLHttpRequest). provideClientHydration reuses the prerendered DOM
    // in the browser and — via its default HTTP transfer cache — replays the
    // server's blog fetches instead of re-fetching, so first paint matches the
    // prerendered HTML (no skeleton/content hydration mismatch).
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
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
    }),
  ],
};
