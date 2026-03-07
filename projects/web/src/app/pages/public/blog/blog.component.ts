import { DatePipe } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { BlogPostData } from 'core';
import { BlogService } from 'core';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { tap } from 'rxjs';

@Component({
  selector: 'bee-blog',
  imports: [RouterLink, ButtonModule, SelectButtonModule, FormsModule, DatePipe, Skeleton],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  private readonly blogService = inject(BlogService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly featuredSection = viewChild<ElementRef<HTMLElement>>('featuredSection');

  private readonly _loaded = signal(false);
  readonly isLoading = computed(() => !this._loaded());
  readonly skeletonItems = [1, 2, 3];

  readonly allPosts = toSignal(
    this.blogService.getAllPostData().pipe(tap(() => this._loaded.set(true))),
    { initialValue: [] as BlogPostData[] },
  );
  readonly selectedCategory = signal('All');

  readonly featuredPost = computed(() => this.allPosts()[0] ?? null);
  readonly gridPosts = computed(() => this.allPosts().slice(1));

  constructor() {
    afterRenderEffect(() => {
      const el = this.featuredSection()?.nativeElement;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height;
        if (height != null) {
          this.hostEl.nativeElement.style.setProperty('--featured-article-height', `${height}px`);
        }
      });
      observer.observe(el);

      return () => observer.disconnect();
    });
  }
}
