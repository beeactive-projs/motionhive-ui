import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { AppLanguage } from '../models/common/language.enums';
import { DEFAULT_LANGUAGE, LANGUAGE_URL_PARAM } from './languages.const';

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

/** Login page on the web app. */
export const LOGIN_URL = `${WEB_APP_URL}/auth/login`;

/**
 * The in-app path a signed-in user lands on when a guest page (sign in, sign
 * up, `guestGuard`) sends them into the app. Web keeps the default; mobile
 * provides its tab root (`/tabs/home`).
 */
export const APP_HOME_URL = new InjectionToken<string>('APP_HOME_URL', {
  factory: () => '/home',
});

/**
 * A web app link that opens the app in `language` rather than the device's
 * stored or browser language, for links out of a page the visitor reads in a
 * known language (the marketing site's sign-up and login buttons).
 */
export function withAppLanguage(url: string, language: AppLanguage): string {
  const target = new URL(url);
  target.searchParams.set(LANGUAGE_URL_PARAM, language);
  return target.toString();
}

/**
 * Public marketing site — a third deploy, separate from both the API and the
 * web app. Per environment like the others (`environment.websiteUrl`): a dev
 * build links to the dev site. Blog articles are only published here; every
 * app that surfaces them links out to this origin.
 */
export const MARKETING_SITE_URL = environment.websiteUrl;

/** Blog index on the marketing site; append `/<slug>` for a single article. */
export const MARKETING_BLOG_URL = `${MARKETING_SITE_URL}/blog`;

/**
 * Legal pages. They live ONLY on the marketing site — the web app has no
 * `/legal/*` routes — so anything in the app (login, signup, consent copy)
 * must link out with absolute URLs (`termsOfServiceUrl`, `privacyPolicyUrl`),
 * not a `routerLink`.
 */
export const TERMS_OF_SERVICE_PATH = '/legal/terms-of-service';
export const PRIVACY_POLICY_PATH = '/legal/privacy-policy';
/** How to delete an account, and what happens to the data. The store listings link here too. */
export const DELETE_ACCOUNT_PATH = '/legal/delete-account';

/**
 * A marketing site page in `language`. The site serves the default language at
 * the root and every other one under its code: `marketingSiteUrl('/', 'ro')` is
 * `…/ro/`, `marketingSiteUrl(PRIVACY_POLICY_PATH, 'en')` is `…/legal/privacy-policy`.
 */
export function marketingSiteUrl(path: string, language: AppLanguage): string {
  const prefix = language === DEFAULT_LANGUAGE ? '' : `/${language}`;
  return `${MARKETING_SITE_URL}${prefix}${path}`;
}

/** The terms of service on the marketing site, in `language`. */
export function termsOfServiceUrl(language: AppLanguage): string {
  return marketingSiteUrl(TERMS_OF_SERVICE_PATH, language);
}

/** The privacy policy on the marketing site, in `language`. */
export function privacyPolicyUrl(language: AppLanguage): string {
  return marketingSiteUrl(PRIVACY_POLICY_PATH, language);
}

/** The delete-account page on the marketing site, in `language`. */
export function deleteAccountUrl(language: AppLanguage): string {
  return marketingSiteUrl(DELETE_ACCOUNT_PATH, language);
}

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
