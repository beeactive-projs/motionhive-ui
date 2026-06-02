import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  ListProgramsQuery,
  PaginatedPrograms,
  Program,
  ProgramService,
  ProgramStatus,
  showApiError,
} from 'core';

/**
 * Programs list (FE-P1, read surface).
 *
 * Builder ships in FE-P2 — the create CTA is wired to a toast for
 * now because authoring a program shell without nested workout/set
 * UX would create empty rows the instructor can't fill in yet.
 */
@Component({
  selector: 'mh-programs',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TitleCasePipe,
    ButtonModule,
    InputTextModule,
    Toast,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Programs {
  private readonly _programService = inject(ProgramService);
  private readonly _messageService = inject(MessageService);

  // ── State ────────────────────────────────────────────────────────

  readonly items = signal<Program[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly searchInput = signal('');
  readonly search = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statusFilter = signal<ProgramStatus | null>(null);

  // ── Derived ──────────────────────────────────────────────────────

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly statusTabs: { value: ProgramStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: ProgramStatus.Draft, label: 'Draft' },
    { value: ProgramStatus.Published, label: 'Published' },
    { value: ProgramStatus.Archived, label: 'Archived' },
  ];

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

  openCreateStub(): void {
    this._messageService.add({
      severity: 'info',
      summary: 'Coming next',
      detail: 'Program builder lands in the next slice (FE-P2).',
      life: 4000,
    });
  }

  workoutCount(p: Program): number | null {
    // The list endpoint does NOT include workouts (per BE: read for
    // performance). Detail loads them. Show '—' here.
    return p.workouts?.length ?? null;
  }

  statusTone(s: ProgramStatus): 'draft' | 'published' | 'archived' {
    switch (s) {
      case ProgramStatus.Published:
        return 'published';
      case ProgramStatus.Archived:
        return 'archived';
      default:
        return 'draft';
    }
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(replace: boolean): void {
    const query: ListProgramsQuery = {
      page: this.page(),
      limit: this.pageSize,
      search: this.search() || undefined,
      status: this.statusFilter() ?? undefined,
    };

    if (replace) this.loading.set(true);
    else this.loadingMore.set(true);

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
        showApiError(
          this._messageService,
          "Couldn't load programs",
          'Check your connection and try again.',
          err,
        );
        settle();
      },
    });
  }
}
