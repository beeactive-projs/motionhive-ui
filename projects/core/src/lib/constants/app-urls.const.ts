import { environment } from '../../environments/environment';

/**
 * Base origin of the authenticated MotionHive web app (e.g.
 * `https://app.motionhive.fit`). It's a separate deploy from the
 * marketing site, so cross-app links must be absolute URLs to this
 * origin — a `routerLink` can't reach it. Resolved at runtime from
 * `environment.webAppUrl`.
 */
export const WEB_APP_URL = environment.webAppUrl;

/** Signup / register page on the web app. */
export const SIGNUP_URL = `${WEB_APP_URL}/auth/signup`;

/**
 * Public marketing site — a third deploy, separate from both the API and the
 * web app, so it is not derived from `environment`. Blog articles are only
 * published here; every app that surfaces them links out to this origin.
 */
export const MARKETING_SITE_URL = 'https://www.motionhive.fit';

/** Blog index on the marketing site; append `/<slug>` for a single article. */
export const MARKETING_BLOG_URL = `${MARKETING_SITE_URL}/blog`;

/**
 * Destination for a blog author's byline.
 *
 * - Registered external author (has a handle) → their public profile at
 *   `${WEB_APP_URL}/@<handle>`.
 * - MotionHive's own content (guest byline / no handle) → the signup
 *   page, nudging readers to join.
 */
export function authorBylineUrl(handle: string | null | undefined): string {
  return handle ? `${WEB_APP_URL}/@${handle}` : SIGNUP_URL;
}
