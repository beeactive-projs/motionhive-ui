import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import {
  MESSAGING_ROUTES,
  authInterceptor,
  errorInterceptor,
  loadingInterceptor,
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
    provideIonicAngular({ mode: 'md' }),
    // Messaging lives inside a tab stack here, not at web's /messages.
    { provide: MESSAGING_ROUTES, useValue: ['/tabs/messages'] },
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withXhr(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor]),
    ),
  ],
};
