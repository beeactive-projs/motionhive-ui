import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, shareReplay, switchMap } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import type { BlogPost } from 'core';
import { authorBylineUrl, BLOG_COVER_PRESETS, BlogService, withCloudinaryTransform } from 'core';
import { BlogCategoryPipe } from '../blog-category.pipe';
import { SeoService } from '../../_shared/seo.service';
import { enrichArticleContent } from '../../_shared/article-content.util';
import { ArticleProse } from '../../_shared/article-prose/article-prose';
import { ArticleToc } from '../../_shared/article-toc/article-toc';
import { ReadingProgress } from '../../_shared/reading-progress/reading-progress';
import { ShareBar } from '../../_shared/share-bar/share-bar';
import { BlogByline } from '../_shared/blog-byline/blog-byline';
import { BlogPostCard } from '../_shared/blog-post-card/blog-post-card';

/** Canonical marketing origin (mirrors PublicLayoutComponent). */
const SITE_ORIGIN = 'https://www.motionhive.fit';

@Component({
  selector: 'mh-blog-article',
  imports: [
    RouterLink,
    ButtonModule,
    DatePipe,
    Skeleton,
    BlogCategoryPipe,
    ArticleProse,
    ArticleToc,
    ReadingProgress,
    ShareBar,
    BlogByline,
    BlogPostCard,
  ],
  templateUrl: './blog-article.component.html',
  styleUrl: './blog-article.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArticleComponent {
  private readonly _blogService = inject(BlogService);
  private readonly _router = inject(Router);
  private readonly _seo = inject(SeoService);
  private readonly _document = inject(DOCUMENT);

  /** Article body element — the reading-progress bar tracks its scroll range. */
  readonly articleBody = viewChild<ElementRef<HTMLElement>>('articleBody');
  readonly bodyEl = computed(() => this.articleBody()?.nativeElement ?? null);

  private readonly _isRo = (this._document.documentElement.lang || 'en')
    .toLowerCase()
    .startsWith('ro');

  private readonly _post$ = inject(ActivatedRoute).paramMap.pipe(
    map((p) => p.get('slug') ?? ''),
    filter((slug) => slug.length > 0),
    switchMap((slug) =>
      this._blogService.getBySlug(slug).pipe(
        catchError(() => {
          this._router.navigate(['/blog']);
          return of(null as BlogPost | null);
        }),
      ),
    ),
    shareReplay(1),
  );

  readonly post = toSignal<BlogPost | null>(this._post$, { initialValue: null });
  readonly isLoading = computed(() => this.post() === null);

  /** Content HTML enriched with heading anchor ids, plus the TOC headings. */
  private readonly _enriched = computed(() => enrichArticleContent(this.post()?.content));
  readonly contentHtml = computed(() => this._enriched().html);
  readonly headings = computed(() => this._enriched().headings);

  /** Absolute, locale-correct URL of this article (share + structured data). */
  readonly articleUrl = computed(() => {
    const p = this.post();
    if (!p) return SITE_ORIGIN;
    return `${SITE_ORIGIN}${this._isRo ? '/ro' : ''}/blog/${p.slug}`;
  });

  /** Editorial bio for the author card when the post has no coach handle. */
  readonly bylineBio = computed(() => {
    const p = this.post();
    if (!p || p.authorHandle) return null;
    return $localize`:@@blog.byline.editorialBio:The MotionHive team, writing about coaching, training, and building a business around helping people move.`;
  });

  readonly relatedPosts = toSignal(
    this._post$.pipe(
      switchMap((post) => {
        if (!post) return of([] as BlogPost[]);
        return this._blogService
          .getRelatedPosts(post.slug, post.category)
          .pipe(catchError(() => of([] as BlogPost[])));
      }),
    ),
    { initialValue: [] as BlogPost[] },
  );

  constructor() {
    // Per-article SEO/social tags + JSON-LD. Runs when the post resolves;
    // during prerender that's before serialization (SSR waits for the
    // fetch), so the article's own metadata + structured data bake into
    // the static <head>.
    effect(() => {
      const p = this.post();
      if (!p) return;

      this._seo.setArticle({
        title: `${p.title} - MotionHive`,
        description: p.excerpt,
        image: p.coverImage || undefined,
        publishedTime: p.publishedAt,
        modifiedTime: p.updatedAt,
        author: p.authorName,
        section: p.category,
      });

      this._seo.setJsonLd('ld-article', this._buildArticleLd(p));
      this._seo.setJsonLd('ld-breadcrumb', this._buildBreadcrumbLd(p));
    });
  }

  /** Article hero — wide cinematic crop, ~1600px wide. */
  heroCoverUrl(url: string | null | undefined): string {
    return withCloudinaryTransform(url, BLOG_COVER_PRESETS.articleHero);
  }

  private _buildArticleLd(p: BlogPost): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.excerpt,
      image: p.coverImage ? [p.coverImage] : undefined,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt,
      inLanguage: this._isRo ? 'ro' : 'en',
      articleSection: p.category,
      keywords: p.tags?.length ? p.tags.join(', ') : undefined,
      author: p.authorHandle
        ? { '@type': 'Person', name: p.authorName, url: authorBylineUrl(p.authorHandle) }
        : { '@type': 'Organization', name: p.authorName },
      publisher: {
        '@type': 'Organization',
        name: 'MotionHive',
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/png/logo-bg-navy.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': this.articleUrl() },
    };
  }

  private _buildBreadcrumbLd(p: BlogPost): Record<string, unknown> {
    const blogUrl = `${SITE_ORIGIN}${this._isRo ? '/ro' : ''}/blog`;
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Blog', item: blogUrl },
        { '@type': 'ListItem', position: 2, name: p.category, item: this.articleUrl() },
      ],
    };
  }
}
