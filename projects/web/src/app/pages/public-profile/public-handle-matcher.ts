import { UrlMatcher, UrlSegment } from '@angular/router';

/**
 * Matches `/public/@<handle>` — the canonical share-target URL for the
 * unauthenticated entry point.
 *
 * Only consumes the first two segments so child routes (`/contact`,
 * `/share`, tab paths) can match the remainder.
 */
export const publicHandleMatcher: UrlMatcher = (segments) => {
  if (segments.length < 2) return null;
  if (segments[0].path !== 'public') return null;
  const second = segments[1];
  if (!second.path.startsWith('@') || second.path.length < 2) return null;
  return {
    consumed: [segments[0], segments[1]],
    posParams: { handle: new UrlSegment(second.path.slice(1), {}) },
  };
};
