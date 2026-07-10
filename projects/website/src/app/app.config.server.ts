import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * Server-side (prerender) configuration. Merged on top of the shared browser
 * `appConfig`, adding the SSR renderer + the per-route render strategy
 * (`app.routes.server.ts`). Only used at build time for prerendering.
 */
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
