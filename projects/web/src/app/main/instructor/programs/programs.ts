import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import {
  ListProgramsQuery,
  MobileFab,
  PaginatedPrograms,
  Program,
  ProgramService,
  ProgramStatus,
  TagSeverity,
  apiErrorMessage,
  injectIsMobile,
  injectIsTablet,
  injectIsTabletDown,
} from 'core';

import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { ProgramFormDialog } from './program-form-dialog/program-form-dialog';

/**
 * Programs list (FE-P1, read surface).
 *
 * The create CTA opens the metadata dialog; nested workout/set authoring
 * happens on the program-detail page.
 *
 * Layout mirrors the sessions list: a Tailwind shell, a projected
 * `#filtersRow` holding the status pills + search, and a single content
 * body that switches between error / skeleton / empty / grid. Unlike
 * sessions there are no `p-tabs` — status is a filter over one list, not
 * a top-level surface switch, so it renders as quick-filter pills.
 */
@Component({
  selector: 'mh-programs',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    TitleCasePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    Card,
    IconField,
    InputIcon,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    Tag,
    ListEmptyState,
    MobileFab,
    ProgramFormDialog,
  ],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Programs {
  private readonly _programService = inject(ProgramService);

  // ── Responsive ───────────────────────────────────────────────────
  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();
  /** Tablet or smaller — the "compact" surface (smaller copy). */
  protected readonly isTabletDown = injectIsTabletDown();

  // ── State ────────────────────────────────────────────────────────

  readonly items = signal<Program[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly searchInput = signal('');
  readonly search = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statusFilter = signal<ProgramStatus | null>(null);
  readonly formDialogOpen = signal(false);

  /** Placeholder rows for the skeleton grid. */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  // ── Derived ──────────────────────────────────────────────────────

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly statusTabs: { status: ProgramStatus | null; label: string }[] = [
    { status: null, label: 'All' },
    { status: ProgramStatus.Draft, label: 'Draft' },
    { status: ProgramStatus.Published, label: 'Published' },
    { status: ProgramStatus.Archived, label: 'Archived' },
  ];

  /** Status-aware empty-state copy. Only All/Draft offer a create CTA. */
  readonly emptyState = computed(() => {
    switch (this.statusFilter()) {
      case ProgramStatus.Draft:
        return {
          icon: 'pi pi-pencil',
          title: 'No draft programs',
          message: "Programs you're still authoring show up here.",
          action: true,
        };
      case ProgramStatus.Published:
        return {
          icon: 'pi pi-check-circle',
          title: 'No published programs',
          message: 'Publish a program to make it assignable to clients.',
          action: false,
        };
      case ProgramStatus.Archived:
        return {
          icon: 'pi pi-inbox',
          title: 'No archived programs',
          message: 'Archived programs are hidden but not deleted.',
          action: false,
        };
      default:
        return {
          icon: 'pi pi-objects-column',
          title: 'No programs yet',
          message:
            'Programs are how you author your coaching plans — workouts, exercises, and sets your clients follow. Create your first one to get started.',
          action: true,
        };
    }
  });

  constructor() {
    // Effect-driven refetch on any filter change.
    effect(() => {
      this.search();
      this.statusFilter();
      this.page.set(1);
      this.fetch(true);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  setStatus(value: ProgramStatus | null): void {
    this.statusFilter.set(value);
  }

  onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.search.set(value.trim()), 300);
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  openCreate(): void {
    this.formDialogOpen.set(true);
  }

  retry(): void {
    this.fetch(true);
  }

  onCreated(p: Program): void {
    // Prepend the new program so the instructor sees it without waiting
    // for a refetch. The next filter change will reset the list anyway.
    this.items.update((cur) => [p, ...cur]);
    this.total.update((t) => t + 1);
    this.formDialogOpen.set(false);
  }

  statusSeverity(s: ProgramStatus): TagSeverity {
    switch (s) {
      case ProgramStatus.Published:
        return TagSeverity.Success;
      case ProgramStatus.Archived:
        return TagSeverity.Contrast;
      default:
        return TagSeverity.Secondary;
    }
  }

  /** Human duration label — weeks when the day count divides evenly. */
  durationLabel(days: number): string {
    if (days % 7 === 0) {
      const weeks = days / 7;
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(replace: boolean): void {
    const query: ListProgramsQuery = {
      page: this.page(),
      limit: this.pageSize,
      search: this.search() || undefined,
      status: this.statusFilter() ?? undefined,
    };

    if (replace) {
      this.loading.set(true);
      this.error.set(null);
    } else {
      this.loadingMore.set(true);
    }

    const settle = () => {
      // Fires on BOTH success and error — RxJS's `complete` does NOT
      // fire after `error`, so putting the loading flag only in
      // `complete` leaves the page stuck on the skeleton when the
      // BE is unreachable. Same bug existed in exercises.ts.
      this.loading.set(false);
      this.loadingMore.set(false);
    };
    this._programService.list(query).subscribe({
      next: (res: PaginatedPrograms) => {
        if (replace) this.items.set(res.items);
        else this.items.update((cur) => [...cur, ...res.items]);
        this.total.set(res.total);
        settle();
      },
      error: (err) => {
        this.error.set(
          apiErrorMessage(err, 'Check your connection and try again.'),
        );
        settle();
      },
    });
  }
}
