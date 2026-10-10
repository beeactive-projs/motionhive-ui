import { ViewportScroller } from '@angular/common';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { NetworkAwarePreloadingStrategy } from './_shared/network-aware-preloading.strategy';
import { MotionHiveLara } from '../../../core/src/styles/styles.primeng';
import { environment } from 'core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withPreloading(NetworkAwarePreloadingStrategy),
    ),
    // Fragment links (e.g. the privacy policy TOC) scroll under the sticky
    // header without this offset (header bar is 4.4rem tall).
    provideAppInitializer(() => inject(ViewportScroller).setOffset([0, 80])),
    // withFetch(): use the Fetch API so HttpClient works during prerender (Node
    // has no XMLHttpRequest). provideClientHydration reuses the prerendered DOM
    // in the browser and — via its default HTTP transfer cache — replays the
    // server's blog fetches instead of re-fetching, so first paint matches the
    // prerendered HTML (no skeleton/content hydration mismatch).
    provideHttpClient(withFetch()),
    // withI18nSupport() is load-bearing: without it Angular marks every
    // component that holds `i18n` text (header, footer, every page) with
    // `ngSkipHydration`, then throws the prerendered DOM away and renders the
    // whole page again once the JS arrives. That re-render was the slow,
    // flashing first load on phones.
    provideClientHydration(withEventReplay(), withI18nSupport(), withNoIncrementalHydration()),
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
  ],
};
