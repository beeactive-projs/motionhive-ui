import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, shareReplay, switchMap } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import type { BlogPost } from 'core';
import { BlogService } from 'core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'bee-blog-article',
  imports: [RouterLink, ButtonModule, DatePipe, Skeleton],
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

  constructor() {
    afterRenderEffect(() => {
      const el = this.coverImage()?.nativeElement;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height;
        if (height != null) {
          this._elementRef.nativeElement.style.setProperty('--featured-article-image', `${height}px`);
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
}
