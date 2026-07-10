import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoInput {
  /** Full document/OG title. When set, also updates `<title>`. */
  title?: string;
  /** Meta description + og/twitter description. */
  description: string;
  /** Absolute URL for the social-share image (og/twitter). */
  image?: string;
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
}
