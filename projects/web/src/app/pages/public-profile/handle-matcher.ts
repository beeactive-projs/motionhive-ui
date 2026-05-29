import { UrlMatcher, UrlSegment } from '@angular/router';

/**
 * Matches a single URL segment that starts with `@` (e.g. `/@ionut`) and
 * exposes the part after the `@` as the `handle` route param.
 *
 * Only consumes the first segment so child routes (e.g. `/contact`, `/share`,
 * tab paths) can match the remainder.
 *
 * Used by both the top-level guest route (in `app.routes.ts`) and the
 * in-`main` authed route (in `main.routes.ts`) so the same canonical URL
 * works in both layouts.
 */
export const handleMatcher: UrlMatcher = (segments) => {
  if (segments.length === 0) return null;
  const first = segments[0];
  if (!first.path.startsWith('@') || first.path.length < 2) return null;
  return {
    consumed: [first],
    posParams: { handle: new UrlSegment(first.path.slice(1), {}) },
  };
};
