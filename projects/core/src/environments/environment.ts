/**
 * The same compiled bundle ships to prod and dev — at boot we look at
 * the host the app loaded from and pick the matching API URL. This
 * keeps prod from ever pointing at localhost (the file used to be
 * hand-edited and the wrong URL leaked to prod multiple times).
 */
const PROD_API = 'https://motionhive-api-production.up.railway.app';
const DEV_API = 'https://dev-motionhive-api-production.up.railway.app';
const LOCAL_API = 'http://localhost:3800';

function resolveApiUrl(): string {
  if (typeof window === 'undefined') return PROD_API;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return LOCAL_API;
  // Anything that smells like a dev deploy — Vercel preview hosts get
  // the `dev-` prefix or the `dev.` subdomain — points at the dev API.
  if (host.startsWith('dev-') || host.startsWith('dev.') || host.includes('-git-develop-')) {
    return DEV_API;
  }
  return PROD_API;
}

function resolveAppUrl(): string {
  if (typeof window === 'undefined') return 'https://motionhive.fit';
  return `${window.location.protocol}//${window.location.host}`;
}

export const environment = {
  production: true,
  appUrl: 'http://localhost:4200',
  //apiUrl: 'https://beeactive-api-production.up.railway.app',
  //apiUrl: 'http://localhost:3800',
  googleClientId: '119425399334-29l3eq2mo162t0vlh8qfoqgi2cg0djfp.apps.googleusercontent.com',
  apiUrl: resolveApiUrl(),
  facebookAppId: '888056193830836',
};
