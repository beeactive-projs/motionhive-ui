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
 * Legal pages. They live ONLY on the marketing site — the web app has no
 * `/legal/*` routes — so anything in the app (login, signup, consent copy)
 * must link out with these absolute URLs, not a `routerLink`.
 */
export const TERMS_OF_SERVICE_URL = `${MARKETING_SITE_URL}/legal/terms-of-service`;
export const PRIVACY_POLICY_URL = `${MARKETING_SITE_URL}/legal/privacy-policy`;
export const COOKIE_POLICY_URL = `${MARKETING_SITE_URL}/legal/cookie-policy`;

/**
 * A coach's public profile — the one URL in this product that a stranger can
 * open without an account, so it is the share target for anything
 * profile-shaped.
 *
 * Note the web app also serves a `/public/@<handle>` route it calls canonical;
 * `/@<handle>` reaches the same page because a guard bounces guests there.
 * Every existing call site builds the short form, so this keeps it rather than
 * splitting the convention — switching them all is a separate change.
 */
export function publicProfileUrl(handle: string): string {
  return `${WEB_APP_URL}/@${handle}`;
}

/**
 * Destination for a blog author's byline.
 *
 * - Registered external author (has a handle) → their public profile.
 * - MotionHive's own content (guest byline / no handle) → the signup
 *   page, nudging readers to join.
 */
export function authorBylineUrl(handle: string | null | undefined): string {
  return handle ? publicProfileUrl(handle) : SIGNUP_URL;
}
