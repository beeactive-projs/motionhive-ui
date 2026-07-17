import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';

import { environment } from '../../../core/src/environments/environment';
import { FEATURES } from './_data/features';

/**
 * Per-route render strategy for prerendering (SSG).
 *
 * Every route is prerendered to static HTML at build time so crawlers and
 * no-JS visitors receive fully-populated pages. Static routes (`/`, `/about`,
 * `/tools/*`, `/legal/*`) are discovered automatically from the Angular router
 * config. Blog articles are parameterised, so we enumerate their slugs at build
 * time via `getPrerenderParams`.
 */

/**
 * Locale of the current localized build (this file is compiled once per locale:
 * `en` at `/`, `ro` at `/ro/`). Blog posts are per-language, and the article
 * page fetches a post in the site's locale — so we must prerender ONLY the
 * slugs of that language, or cross-language slugs 404 and prerender blank.
 * `$localize.locale` is set by the localize runtime; the source locale (`en`)
 * leaves it undefined, hence the fallback.
 */
function currentLocale(): string {
  const l = (globalThis as unknown as { $localize?: { locale?: string } }).$localize?.locale;
  return (l ?? 'en').split('-')[0];
}

/**
 * Fetch the published blog slugs FOR THE BUILD'S LOCALE so each article gets its
 * own prerendered page in the right language.
 *
 * Runs in Node during `ng build`, where `window` is undefined — so
 * `environment.apiUrl` resolves to the production API (see environment.ts).
 * Pages through `GET /blog?locale=<locale>` (max 100/page) until exhausted. On
 * any failure it returns an empty list: the build still succeeds and unlisted
 * articles fall back to client-side rendering (see `fallback` below).
 *
 * NOTE: a post published between deploys won't be prerendered until the next
 * build — the API pings a Vercel deploy hook on publish to trigger that.
 */
async function fetchPublishedBlogSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  const limit = 100;
  const locale = currentLocale();
  try {
    // Hard page cap (50 × 100 = 5000 posts) guards against an unbounded loop.
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(
        `${environment.apiUrl}/blog?locale=${locale}&page=${page}&limit=${limit}`,
      );
      if (!res.ok) break;
      const body = (await res.json()) as { items?: Array<{ slug?: string }> };
      const items = body.items ?? [];
      for (const item of items) {
        if (item.slug) slugs.push(item.slug);
      }
      if (items.length < limit) break;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[prerender] Could not fetch blog slugs; articles will fall back to CSR:',
      err,
    );
  }
  return slugs;
}

export const serverRoutes: ServerRoute[] = [
  {
    // The 7 feature pages are driven by a static data array, so their slugs are
    // known at build time with no network call (unlike the blog).
    path: 'features/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return FEATURES.map((f) => ({ slug: f.slug }));
    },
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    // A slug published after this build (not in the prerendered set) still
    // renders client-side instead of returning a 404.
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      const slugs = await fetchPublishedBlogSlugs();
      return slugs.map((slug) => ({ slug }));
    },
  },
  {
    // Everything else (home, about, tools, legal, …) → prerendered static HTML.
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
