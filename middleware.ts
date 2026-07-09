/**
 * Vercel Edge Middleware — geo-based language for the MotionHive marketing site.
 *
 * The site ships two prerendered locale bundles: English at `/` and Romanian at
 * `/ro/` (see vercel.json rewrites). On a visitor's FIRST request we look at the
 * country Vercel attaches to every edge request (`x-vercel-ip-country`) and, if
 * they're in Romania, send them to the Romanian bundle. Everyone else gets
 * English (the default).
 *
 * Rules that keep it from being annoying / wrong:
 *  - We only redirect when there is NO `mh_lang` cookie. The moment a visitor is
 *    redirected — or manually flips the EN/RO switch (which sets the cookie) —
 *    their choice is remembered and we never override it again.
 *  - 307 (temporary), so search engines keep both `/` and `/ro/` indexed. Googlebot
 *    crawls from the US, so it keeps seeing English; hreflang tags (added in the app)
 *    tell it about the Romanian alternates.
 *  - The matcher skips the `/ro` bundle (no redirect loop) and all static assets.
 *
 * NOTE: the geo header is only populated on Vercel — locally it's empty, so nothing
 * redirects in `ng serve`. That's expected; test on a Vercel preview deployment.
 */

export const config = {
  // Run on real page requests only: not the /ro bundle, not files (anything with a dot).
  matcher: ['/((?!ro/?$|ro/|.*\\.).*)'],
};

const COOKIE = 'mh_lang';
const ONE_YEAR = 60 * 60 * 24 * 365;

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url);

  // Safety: never touch the authenticated app domain if it ever shares this config.
  if (url.hostname.startsWith('app.')) return undefined;

  // Respect an explicit language choice forever.
  const cookies = request.headers.get('cookie') ?? '';
  if (new RegExp(`(?:^|;\\s*)${COOKIE}=`).test(cookies)) return undefined;

  // Already on the Romanian bundle — leave it alone.
  if (url.pathname === '/ro' || url.pathname.startsWith('/ro/')) return undefined;

  // Default to Romanian for two audiences (Romania-first community goal):
  //  - anyone physically in Romania (even with an English browser/OS, which is
  //    common here) — via the country Vercel tags on every edge request; and
  //  - Romanians abroad whose browser explicitly prefers `ro` (diaspora reach).
  const country = request.headers.get('x-vercel-ip-country');
  const accept = request.headers.get('accept-language') ?? '';
  const prefersRo = country === 'RO' || /(?:^|,)\s*ro\b/i.test(accept);
  if (!prefersRo) return undefined;

  // First-time Romanian visitor → Romanian bundle, and remember it.
  const target = new URL(`/ro${url.pathname}${url.search}`, request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: target.toString(),
      'Set-Cookie': `${COOKIE}=ro; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`,
    },
  });
}
