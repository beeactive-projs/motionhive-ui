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
    provideIonicAngular(),
    // Messaging lives inside a tab stack here, not at web's /messages.
    { provide: MESSAGING_ROUTES, useValue: ['/tabs/messages'] },
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withXhr(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor]),
    ),
  ],
};
