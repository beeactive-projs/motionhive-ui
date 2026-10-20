/**
 * The same compiled bundle ships to prod and dev — at boot we look at
 * the host the app loaded from and pick the matching API URL. This
 * keeps prod from ever pointing at localhost (the file used to be
 * hand-edited and the wrong URL leaked to prod multiple times).
 */
const PROD_API = 'https://motionhive-api-production.up.railway.app';
const DEV_API = 'https://dev-motionhive-api-production.up.railway.app';
const LOCAL_API = 'http://localhost:3800';

const PROD_WEB_APP = 'https://app.motionhive.fit';
const DEV_WEB_APP = 'https://dev.app.motionhive.fit';

const PROD_WEBSITE = 'https://www.motionhive.fit';
const DEV_WEBSITE = 'https://dev.motionhive.fit';

/**
 * Anything that smells like a dev deploy: `dev.motionhive.fit`,
 * `dev.app.motionhive.fit`, and Vercel preview hosts with the `dev-` prefix
 * or a develop-branch slug.
 */
function isDevHost(host: string): boolean {
  return host.startsWith('dev-') || host.startsWith('dev.') || host.includes('-git-develop-');
}

function resolveApiUrl(): string {
  if (typeof window === 'undefined') return PROD_API;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return LOCAL_API;
  return isDevHost(host) ? DEV_API : PROD_API;
}

function resolveAppUrl(): string {
  if (typeof window === 'undefined') return 'https://motionhive.fit';
  return `${window.location.protocol}//${window.location.host}`;
}

/**
 * Origin of the authenticated MotionHive web app — a *separate* deploy
 * from the marketing site (this bundle also ships to `website`). The
 * marketing site links across to it for public `/@<handle>` profiles
 * and the signup page. Resolved by host like `resolveApiUrl()`, and for
 * the same reason: a dev deploy reads the dev database, so its invite
 * tokens and handles only resolve on the dev web app.
 */
function resolveWebAppUrl(): string {
  if (typeof window === 'undefined') return PROD_WEB_APP;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4200';
  return isDevHost(host) ? DEV_WEB_APP : PROD_WEB_APP;
}

/**
 * Origin of the marketing site (blog, legal pages). Local runs link to the
 * dev site: the website is rarely served next to the app locally, and its
 * blog reads the dev API like a local app would.
 */
function resolveWebsiteUrl(): string {
  if (typeof window === 'undefined') return PROD_WEBSITE;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return DEV_WEBSITE;
  return isDevHost(host) ? DEV_WEBSITE : PROD_WEBSITE;
}

export const environment = {
  production: true,
  appUrl: 'http://localhost:4200',
  //apiUrl: 'https://beeactive-api-production.up.railway.app',
  //apiUrl: 'http://localhost:3800',
  googleClientId: '119425399334-29l3eq2mo162t0vlh8qfoqgi2cg0djfp.apps.googleusercontent.com',
  apiUrl: resolveApiUrl(),
  webAppUrl: resolveWebAppUrl(),
  websiteUrl: resolveWebsiteUrl(),
  facebookAppId: '888056193830836',
  primeUiLicenseKey:
    'eyJpZCI6IjhkZGJlNTZjLTY0YmYtNGM0YS1hZDEyLWE1NjYzYjU4YzdjOCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODU4MjY4MTEsImV4cCI6MTgxNzM2MjgxMX0.TUGio97ZwSoIbJ6rQN9HSAkM1TWMF2o0kTclcnb6hXOLHmSDzta2HVHU8X3yd-uTqYTXIcNGhY9ry9ZrsIEtCA',
};
