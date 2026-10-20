import { DeepLink, resolveDeepLink } from './notification-deep-link';

/**
 * Where a web app link opens inside the app (Android App Links).
 *
 * The manifest claims a set of web app paths (android/app/src/main/
 * AndroidManifest.xml); this turns one of those URLs back into a mobile
 * route. Kept beside the notification resolver because it is the same
 * question: the API builds an email's link as `<screen>/<entityId>?<query>`
 * from the very data a push carries, so the push resolver answers it once
 * the URL is split back into that shape.
 */

/** The auth pages a link can open. Mobile mounts them at the web's paths. */
const AUTH_PAGES = new Set(['login', 'signup', 'reset-password', 'new-password', 'verify-email']);

/**
 * The route for `url`, or null when it is not a link to `host` the app can
 * show. `host` is the web app this build talks to (`WEB_APP_URL`), so a
 * production link reaching a staging build is refused rather than opened
 * against the wrong database.
 */
export function resolveAppLink(url: string, host: string): DeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.host !== host) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const params = Object.fromEntries(parsed.searchParams.entries());
  const queryParams = Object.keys(params).length > 0 ? params : null;

  if (segments[0] === 'auth') {
    const page = segments[1];
    return segments.length === 2 && AUTH_PAGES.has(page)
      ? { commands: ['/auth', page], queryParams }
      : null;
  }

  // A screen can contain a slash itself (`coaching/sessions`), so the whole
  // path is tried as the screen first, then the last segment as its id.
  const query = queryParams ?? undefined;
  const whole = resolveDeepLink({ screen: segments.join('/'), queryParams: query });
  if (whole || segments.length < 2) return whole;
  return resolveDeepLink({
    screen: segments.slice(0, -1).join('/'),
    entityId: segments[segments.length - 1],
    queryParams: query,
  });
}
