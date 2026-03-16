import { DatePipe } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { BlogPostData } from 'core';
import { BlogService } from 'core';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Select } from 'primeng/select';

const PAGE_SIZE = 9;
const PAGE_SIZE_ALL = 10;

@Component({
  selector: 'bee-blog',
  imports: [
    RouterLink,
    ButtonModule,
    FormsModule,
    DatePipe,
    Skeleton,
    InputText,
    Paginator,
    IconField,
    InputIcon,
    Select,
  ],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  private readonly _blogService = inject(BlogService);
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly featuredSection = viewChild<ElementRef<HTMLElement>>('featuredSection');

  readonly isLoading = signal(true);
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];
  readonly posts = signal<BlogPostData[]>([]);
  readonly totalRecords = signal(0);
  readonly currentPage = signal(1);
  readonly searchQuery = signal('');
  readonly selectedCategory = signal('All');
  readonly categories = signal<string[]>([]);

  readonly isFirstPage = computed(() => this.currentPage() === 1);
  readonly hasActiveFilters = computed(
    () => this.searchQuery() !== '' || this.selectedCategory() !== 'All',
  );
  readonly featuredPost = computed(() =>
    !this.hasActiveFilters() && this.isFirstPage() ? (this.posts()[0] ?? null) : null,
  );
  readonly gridPosts = computed(() => (this.featuredPost() ? this.posts().slice(1) : this.posts()));
  readonly categoryOptions = computed(() => ['All', ...this.categories()]);

  private readonly _search$ = new Subject<string>();

  constructor() {
    this._search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this._destroyRef))
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.currentPage.set(1);
        this._loadPosts();
      });

    this._loadPosts();
    this._loadCategories();

    // afterRenderEffect(() => {
    //   const el = this.featuredSection()?.nativeElement;
    //   if (!el) return;

    //   const observer = new ResizeObserver((entries) => {
    //     const height = entries[0]?.contentRect.height;
    //     if (height != null) {
    //       this._elementRef.nativeElement.style.setProperty('--featured-article-height', `${height}px`);
    //     }
    //   });
    //   observer.observe(el);

    //   return () => observer.disconnect();
    // });
  }

  onSearchInput(value: string): void {
    this._search$.next(value);
  }

  onCategoryChange(category: string): void {
    this.selectedCategory.set(category);
    this._loadPosts();
  }

  onClearFilter() {
    this.isLoading.set(true);
    this.selectedCategory.set('All');
    this.currentPage.set(1);
    this.onSearchInput('');
  }

  onPageChange(event: PaginatorState): void {
    this.currentPage.set((event.page ?? 0) + 1);
    this._loadPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private _loadPosts(): void {
    this.isLoading.set(true);
    const category = this.selectedCategory();

    this._blogService
      .getPosts({
        page: this.currentPage(),
        limit: category === 'All' ? PAGE_SIZE_ALL : PAGE_SIZE,
        category: category === 'All' ? undefined : category,
        search: this.searchQuery() || undefined,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((response) => {
        this.posts.set(response.items);
        this.totalRecords.set(response.total);
        this.isLoading.set(false);
      });
  }

  private _loadCategories(): void {
    this._blogService
      .getAllPostData()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((posts) => {
        const cats = [...new Set(posts.map((p) => p.category))].sort();
        this.categories.set(cats);
      });
  }
}
