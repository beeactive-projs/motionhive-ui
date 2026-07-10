import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

/**
 * Server/build-time bootstrap for the marketing site.
 *
 * Used by the Angular CLI during `ng build` to prerender every route to static
 * HTML (SSG — see `outputMode: static` in angular.json). There is no runtime
 * Node server: the output is plain static files served by Vercel exactly like
 * before. This entry only runs at build time.
 */
const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;
