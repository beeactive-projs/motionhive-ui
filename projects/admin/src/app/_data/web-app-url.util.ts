/**
 * Resolve the main `web` app's base URL from the admin app's own host.
 * Used for the impersonation handoff (open the web app in a new tab with
 * a freshly-minted token). Deployment convention: admin runs at
 * `admin.<domain>` and the app at `<domain>`; locally the web app is on
 * port 4200 while admin is on 4203.
 */
export function resolveWebAppUrl(): string {
  if (typeof window === 'undefined') return 'https://motionhive.fit';
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4200';
  }
  // admin.motionhive.fit → motionhive.fit ; admin-… → …
  const appHost = hostname.replace(/^admin\./, '').replace(/^admin-/, '');
  return `${protocol}//${appHost}`;
}
