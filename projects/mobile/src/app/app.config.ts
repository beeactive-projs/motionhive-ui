import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import {
  APP_HOME_URL,
  MESSAGING_ROUTES,
  authInterceptor,
  languageInterceptor,
  errorInterceptor,
  loadingInterceptor,
  provideAppI18n,
} from 'core';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Pinned, not auto-detected. `fill="outline"`/`"solid"` on ion-input,
    // ion-textarea and ion-select are Material-only — Ionic ships no ios
    // counterpart — so under an iOS user agent every field in every sheet
    // rendered as bare text with no border. The design this app is built to is
    // Material throughout, so it declares that rather than styling around it.
    // Material's built-in glyphs are the sharp set; this app's icons are all
    // outline (.claude/rules/icons.md). The searchbar's cancel button reads the
    // same key. The name is registered in app.ts.
    provideIonicAngular({ mode: 'md', backButtonIcon: 'chevron-back-outline' }),
    // Messaging lives inside a tab stack here, not at web's /messages.
    { provide: MESSAGING_ROUTES, useValue: ['/tabs/messages'] },
    // Where core's guestGuard sends a signed-in user off the auth pages.
    { provide: APP_HOME_URL, useValue: '/tabs/home' },
    provideRouter(routes, withPreloading(PreloadAllModules)),
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
  ],
};
