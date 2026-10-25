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
    // Each platform gets its own mode, which is Ionic's default behaviour.
    //
    // This was pinned to `md` because `fill="outline"` on ion-input and
    // ion-textarea is Material-only, so under iOS every field rendered as
    // bare text with no border. The cost was paid on every other control:
    // Material letter-spacing on buttons, tabs and segments, Material headers
    // and a ripple an iPhone tap is too quick to show. The fields carry
    // `mode="md"` themselves instead, which is what Ionic documents for
    // exactly this case, so an iPhone gets iOS everywhere else.
    //
    // Material's built-in glyphs are the sharp set; this app's icons are all
    // outline (.claude/rules/icons.md). The searchbar's cancel button reads the
    // same key. The name is registered in app.ts.
    //
    // No back button text: iOS mode labels the chevron with a hardcoded
    // English "Back", untranslated, and the md header never had one.
    provideIonicAngular({ backButtonIcon: 'chevron-back-outline', backButtonText: '' }),
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
