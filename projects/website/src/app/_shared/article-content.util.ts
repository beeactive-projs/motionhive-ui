/**
 * Article content transform — SSR-safe, string-based.
 *
 * The blog body is one HTML string (`blog_post.content`). The article
 * page needs stable anchor ids on every heading (for the "On this page"
 * table of contents and deep links) and a flat list of those headings.
 *
 * This runs during Angular's static prerender, where the DOM shim
 * (domino) is fragile — walking the live DOM or using `document` is what
 * blanked the header once before. So the transform is a pure string pass
 * over the constrained HTML the build pipeline emits (`<h2>text</h2>`,
 * `<h3>text</h3>`, optionally with inline `<a>/<strong>/<em>`), with no
 * DOM access at all. The enriched HTML is bound with `[innerHTML]`, so
 * the ids bake into the prerendered output and deep links work with JS
 * disabled.
 */

/** A heading lifted out of the article body for the table of contents. */
export interface ArticleHeading {
  /** Stable anchor id injected onto the heading element. */
  id: string;
  /** Plain-text label (inline tags stripped, entities decoded). */
  text: string;
  /** 2 = `<h2>` (section), 3 = `<h3>` (sub-section). */
  level: 2 | 3;
}

export interface EnrichedArticle {
  /** Article HTML with `id="…"` present on every h2/h3. */
  html: string;
  /** Headings in document order, minus any excluded (e.g. Sources). */
  headings: ArticleHeading[];
}

export interface EnrichOptions {
  /**
   * Headings whose plain text matches one of these (case-insensitive) get
   * an id for linking but are kept OUT of the `headings` list, so the TOC
   * does not show bibliography/appendix sections. Defaults cover the
   * EN + RO "Sources" heading the articles close on.
   */
  excludeFromToc?: RegExp;
}

const DEFAULT_EXCLUDE = /^(sources|surse|references|referin[țt]e|bibliografie)$/i;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Strip inline tags and decode the handful of entities the pipeline emits. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#?[a-z0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * URL-safe anchor slug. Diacritics are folded (RO: ă â î ș ț → a a i s t)
 * so ids stay ASCII and stable across locales.
 */
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Read an existing `id="…"` off an opening tag's attribute string. */
function existingId(attrs: string): string | null {
  const m = /\sid\s*=\s*"([^"]*)"/i.exec(attrs);
  return m ? m[1] : null;
}

/**
 * Inject anchor ids onto every h2/h3 and return the enriched HTML plus the
 * heading list for the TOC. Pure; safe to call during prerender.
 */
export function enrichArticleContent(
  rawHtml: string | null | undefined,
  opts: EnrichOptions = {},
): EnrichedArticle {
  const html = rawHtml ?? '';
  if (!html) return { html: '', headings: [] };

  const exclude = opts.excludeFromToc ?? DEFAULT_EXCLUDE;
  const headings: ArticleHeading[] = [];
  const used = new Set<string>();

  const enriched = html.replace(
    /<(h[23])((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, inner: string) => {
      const level = (tag.toLowerCase() === 'h2' ? 2 : 3) as 2 | 3;
      const text = toPlainText(inner);

      // Prefer an id the source already carries; else derive one and
      // de-duplicate with a numeric suffix.
      let id = existingId(attrs) || slugifyHeading(text) || `section-${level}`;
      if (used.has(id)) {
        let n = 2;
        while (used.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      used.add(id);

      if (text && !exclude.test(text)) headings.push({ id, text, level });

      const attrsNoId = attrs.replace(/\sid\s*=\s*"[^"]*"/i, '');
      return `<${tag} id="${id}"${attrsNoId}>${inner}</${tag}>`;
    },
  );

  return { html: enriched, headings };
}
