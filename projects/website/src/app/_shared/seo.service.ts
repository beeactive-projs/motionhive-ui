import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoInput {
  /** Full document/OG title. When set, also updates `<title>`. */
  title?: string;
  /** Meta description + og/twitter description. */
  description: string;
  /** Absolute URL for the social-share image (og/twitter). */
  image?: string;
}

export interface ArticleSeoInput extends SeoInput {
  /** ISO publish date → `article:published_time`. */
  publishedTime?: string;
  /** ISO last-modified date → `article:modified_time`. */
  modifiedTime?: string;
  /** Author display name → `article:author`. */
  author?: string;
  /** Category → `article:section`. */
  section?: string;
}

/**
 * Sets per-page SEO/social tags so they're baked into the prerendered HTML.
 *
 * Canonical + hreflang are handled globally in `PublicLayoutComponent`; this
 * covers the per-page `<title>`, meta description, and Open Graph / Twitter
 * card tags. Call it from a component's constructor for static pages, or from
 * an effect once async data (e.g. a blog post) resolves — see BlogArticle.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly _title = inject(Title);
  private readonly _meta = inject(Meta);
  private readonly _document = inject(DOCUMENT);

  set(input: SeoInput): void {
    if (input.title) {
      this._title.setTitle(input.title);
      this._meta.updateTag({ property: 'og:title', content: input.title });
      this._meta.updateTag({ name: 'twitter:title', content: input.title });
    }

    this._meta.updateTag({ name: 'description', content: input.description });
    this._meta.updateTag({ property: 'og:description', content: input.description });
    this._meta.updateTag({ name: 'twitter:description', content: input.description });

    if (input.image) {
      this._meta.updateTag({ property: 'og:image', content: input.image });
      this._meta.updateTag({ name: 'twitter:image', content: input.image });
    }
  }

  /**
   * Article variant of `set` — adds `og:type=article` plus the
   * `article:*` Open Graph properties crawlers use for news/blog cards.
   */
  setArticle(input: ArticleSeoInput): void {
    this.set(input);
    this._meta.updateTag({ property: 'og:type', content: 'article' });
    this._meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

    const props: Array<[string, string | undefined]> = [
      ['article:published_time', input.publishedTime],
      ['article:modified_time', input.modifiedTime],
      ['article:author', input.author],
      ['article:section', input.section],
    ];
    for (const [property, content] of props) {
      if (content) this._meta.updateTag({ property, content });
    }
  }

  /**
   * Upsert a JSON-LD `<script>` in `<head>`, keyed by `id` so a
   * client-side navigation replaces rather than stacks it. Runs during
   * prerender (plain element creation, no innerHTML) so the structured
   * data bakes into the static HTML for crawlers.
   */
  setJsonLd(id: string, data: unknown): void {
    let script = this._document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this._document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      this._document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
