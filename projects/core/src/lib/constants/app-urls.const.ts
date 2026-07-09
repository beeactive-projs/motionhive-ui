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
