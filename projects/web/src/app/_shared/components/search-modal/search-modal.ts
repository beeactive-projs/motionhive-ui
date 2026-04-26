import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, tap, of, catchError } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  RecentSearchesStore,
  SearchEntityType,
  SearchResponse,
  SearchResultItem,
  SearchService,
} from 'core';
import { SearchTriggerService } from './search-trigger.service';

interface CategoryConfig {
  key: SearchEntityType;
  label: string;
  /** Result-key in `SearchResponse.byCategory` this tab maps to. `null` = show all. */
  bucket: keyof SearchResponse['byCategory'] | null;
}

interface TrendingPill {
  label: string;
  query: string;
  /** PrimeIcon class. */
  icon: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

@Component({
  selector: 'mh-search-modal',
  imports: [ButtonModule, DialogModule, InputTextModule, ProgressSpinnerModule],
  templateUrl: './search-modal.html',
  styleUrl: './search-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchModal {
  private readonly _searchService = inject(SearchService);
  private readonly _trigger = inject(SearchTriggerService);
  private readonly _recents = inject(RecentSearchesStore);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  readonly isOpen = this._trigger.isOpen;
  readonly recents = this._recents.entries;

  // ----- Tabs -----
  protected readonly categories: CategoryConfig[] = [
    { key: 'all', label: 'All', bucket: null },
    { key: 'people', label: 'People', bucket: 'users' },
    { key: 'instructors', label: 'Instructors', bucket: 'instructors' },
    { key: 'groups', label: 'Groups', bucket: 'groups' },
    { key: 'sessions', label: 'Sessions', bucket: 'sessions' },
    { key: 'tags', label: 'Tags', bucket: 'tags' },
  ];
  protected readonly activeCategory = signal<SearchEntityType>('all');

  // ----- Query state -----
  protected readonly query = signal('');
  protected readonly isLoading = signal(false);
  protected readonly result = signal<SearchResponse | null>(null);

  /** Stub trending list — recommendations doc says hardcode in v1, real
   *  trending arrives with the jobs module (v2). Keep these short and
   *  topical to the platform. */
  protected readonly trending: TrendingPill[] = [
    { label: 'Yoga', query: 'yoga', icon: 'pi pi-bolt' },
    { label: 'Running', query: 'running', icon: 'pi pi-bolt' },
    { label: 'Strength', query: 'strength', icon: 'pi pi-bolt' },
    { label: 'Pilates', query: 'pilates', icon: 'pi pi-bolt' },
  ];

  // ----- Derived for the template -----
  protected readonly hasQuery = computed(() => this.query().trim().length >= MIN_QUERY_LENGTH);

  /** All non-empty category buckets in display order. */
  protected readonly visibleCategories = computed(() => {
    const r = this.result();
    if (!r) return [];
    const active = this.activeCategory();
    return this.categories
      .filter((c) => c.bucket !== null)
      .filter((c) => active === 'all' || active === c.key)
      .map((c) => ({
        config: c,
        bucket: r.byCategory[c.bucket as keyof SearchResponse['byCategory']],
      }))
      .filter((entry) => entry.bucket && entry.bucket.items.length > 0);
  });

  protected readonly totalResults = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return Object.values(r.byCategory).reduce((sum, b) => sum + (b?.total ?? 0), 0);
  });

  protected readonly visibleCategoryCount = computed(() => this.visibleCategories().length);

  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private readonly _query$ = new Subject<string>();

  constructor() {
    // Pipe: debounce → guard min length → cancel previous in-flight search → render.
    this._query$
      .pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((q) => {
          if (q.trim().length < MIN_QUERY_LENGTH) {
            this.result.set(null);
            this.isLoading.set(false);
          } else {
            this.isLoading.set(true);
          }
        }),
        switchMap((q) => {
          if (q.trim().length < MIN_QUERY_LENGTH) return of(null);
          return this._searchService
            .search({
              q: q.trim(),
              type: this.activeCategory(),
              limit: 5,
            })
            .pipe(
              catchError(() =>
                // Endpoint not built yet → render empty state, never error toast
                of<SearchResponse>({
                  query: q,
                  tookMs: 0,
                  byCategory: {
                    instructors: { items: [], total: 0, nextCursor: null },
                    groups: { items: [], total: 0, nextCursor: null },
                    sessions: { items: [], total: 0, nextCursor: null },
                    tags: { items: [], total: 0, nextCursor: null },
                    users: { items: [], total: 0, nextCursor: null },
                  },
                }),
              ),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.result.set(res);
        this.isLoading.set(false);
      });

    // Re-fire the active query when the user changes tab, so each tab
    // shows category-scoped results without losing the typed query.
    effect(() => {
      const _ = this.activeCategory();
      const q = this.query();
      if (q.trim().length >= MIN_QUERY_LENGTH) this._query$.next(q);
    });

    // Autofocus the input when the modal opens.
    effect(() => {
      if (this.isOpen()) {
        // Defer to next macrotask so PrimeNG has rendered the dialog.
        setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
      }
    });

    // Belt-and-suspenders Escape close. PrimeNG's [closeOnEscape] is on
    // by default but in some browser/focus combinations the input
    // swallows the keystroke before the dialog sees it. A window-level
    // listener gated by isOpen() guarantees the close.
    const onKeydown = (e: KeyboardEvent) => {
      if (!this.isOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    window.addEventListener('keydown', onKeydown);
    this._destroyRef.onDestroy(() => window.removeEventListener('keydown', onKeydown));
  }

  // --- Input handling --------------------------------------------------------

  protected onQueryInput(value: string): void {
    this.query.set(value);
    this._query$.next(value);
  }

  protected onClear(): void {
    this.query.set('');
    this.result.set(null);
    this.searchInput()?.nativeElement.focus();
  }

  protected onSelectCategory(key: SearchEntityType): void {
    this.activeCategory.set(key);
  }

  // --- Result interaction ----------------------------------------------------

  protected onSelectResult(item: SearchResultItem): void {
    // Save what they searched, not what they clicked — recents are query
    // memory, not click history. Click history is a different feature.
    if (this.query().trim().length >= MIN_QUERY_LENGTH) {
      this._recents.push(this.query().trim());
    }
    this._navigateToResult(item);
    this.close();
  }

  protected onSelectRecent(query: string): void {
    this.query.set(query);
    this._query$.next(query);
    this.searchInput()?.nativeElement.focus();
  }

  protected onSelectTrending(pill: TrendingPill): void {
    this.query.set(pill.query);
    this._query$.next(pill.query);
    this.searchInput()?.nativeElement.focus();
  }

  protected onClearRecents(): void {
    this._recents.clear();
  }

  protected onRemoveRecent(query: string, event: Event): void {
    event.stopPropagation();
    this._recents.remove(query);
  }

  protected onSeeAll(category: CategoryConfig): void {
    // Switch to the category tab; the user can keep scrolling there.
    if (category.key !== 'all') this.onSelectCategory(category.key);
  }

  close(): void {
    this._trigger.close();
    // Reset tab back to All for the next session, but preserve the
    // query — bringing the modal back up after closing it is usually
    // intentional, not a fresh thought.
    this.activeCategory.set('all');
  }

  protected onDialogVisibleChange(visible: boolean): void {
    if (!visible) this.close();
  }

  // --- Routing decisions -----------------------------------------------------

  /** Where each result type takes the user when clicked. Today most
   *  destinations route to `/profile/{slug-or-id}` style URLs that
   *  exist in the app. Tags don't have a destination yet — we re-fire
   *  the search filtered by tag. */
  private _navigateToResult(item: SearchResultItem): void {
    switch (item.type) {
      case 'instructor':
        // TODO: route to a public instructor profile page when it exists.
        this._router.navigate(['/profile'], { queryParams: { instructorId: item.id } });
        break;
      case 'group':
        // TODO: replace with a public/member group detail route once it exists.
        this._router.navigate(['/coaching/groups', item.id]);
        break;
      case 'session':
        // TODO: session detail route — sessions module pending.
        this._router.navigate(['/activity/schedule'], { queryParams: { sessionId: item.id } });
        break;
      case 'user':
        this._router.navigate(['/profile'], { queryParams: { userId: item.id } });
        break;
      case 'tag': {
        // No tag-detail page yet; convert the click into a tag-scoped search.
        const tagQuery = item.title.replace(/^#/, '');
        this.query.set(tagQuery);
        this.activeCategory.set('all');
        this._query$.next(tagQuery);
        return; // don't close the modal
      }
    }
  }

  // --- Template helpers ------------------------------------------------------

  protected categoryLabel(type: keyof SearchResponse['byCategory']): string {
    switch (type) {
      case 'instructors':
        return 'Instructors';
      case 'groups':
        return 'Groups';
      case 'sessions':
        return 'Sessions';
      case 'tags':
        return 'Tags';
      case 'users':
        return 'People';
    }
  }

  protected resultIcon(type: SearchResultItem['type']): string {
    switch (type) {
      case 'instructor':
        return 'pi pi-star';
      case 'group':
        return 'pi pi-sitemap';
      case 'session':
        return 'pi pi-calendar';
      case 'tag':
        return 'pi pi-hashtag';
      case 'user':
        return 'pi pi-user';
    }
  }

  protected resultInitials(item: SearchResultItem): string {
    if (item.type === 'tag') return '#';
    const parts = item.title.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }
}
