import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, shareReplay, switchMap } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import type { BlogPost } from 'core';
import { authorBylineUrl, BLOG_COVER_PRESETS, BlogService, withCloudinaryTransform } from 'core';
import { DatePipe } from '@angular/common';
import { BlogCategoryPipe } from '../blog-category.pipe';
import { SeoService } from '../../_shared/seo.service';

@Component({
  selector: 'mh-blog-article',
  imports: [RouterLink, ButtonModule, DatePipe, Skeleton, BlogCategoryPipe],
  templateUrl: './blog-article.component.html',
  styleUrl: './blog-article.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArticleComponent {
  private readonly _blogService = inject(BlogService);
  private readonly _router = inject(Router);
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly coverImage = viewChild<ElementRef<HTMLElement>>('coverImage');

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

  /**
   * Byline link target — an external author's public profile when they
   * have a handle, else the signup page for our own content.
   */
  readonly authorLink = authorBylineUrl;

  private readonly _seo = inject(SeoService);

  constructor() {
    // Per-article SEO/social tags. Runs when the post resolves — during
    // prerender that's before serialization (SSR waits for the fetch), and it
    // fires after the router's generic "Blog - MotionHive" title so the
    // article's own title wins in the prerendered HTML.
    effect(() => {
      const p = this.post();
      if (!p) return;
      this._seo.set({
        title: `${p.title} - MotionHive`,
        description: p.excerpt,
        image: p.coverImage || undefined,
      });
    });

    afterRenderEffect(() => {
      const el = this.coverImage()?.nativeElement;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height;
        if (height != null) {
          this._elementRef.nativeElement.style.setProperty(
            '--featured-article-image',
            `${height}px`,
          );
        }
      });
      observer.observe(el);

      return () => observer.disconnect();
    });
  }

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

  /** Article hero — wide 21:9 cinematic crop, ~1600px wide. */
  heroCoverUrl(url: string | null | undefined): string {
    return withCloudinaryTransform(url, BLOG_COVER_PRESETS.articleHero);
  }

  /** Related-post grid card — 16:9 carousel-sized crop. */
  relatedCoverUrl(url: string | null | undefined): string {
    return withCloudinaryTransform(url, BLOG_COVER_PRESETS.homeCarousel);
  }
}
