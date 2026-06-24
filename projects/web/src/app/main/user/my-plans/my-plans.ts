import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Toast } from 'primeng/toast';

import {
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  injectIsMobile,
  injectIsTabletDown,
  showApiError,
} from 'core';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { SectionLabel } from '../../../_shared/components/section-label/section-label';
import { DaySeparator } from '../../../_shared/components/day-separator/day-separator';
import { MyPlanRow } from './_components/my-plan-row/my-plan-row';

interface StatusTab {
  /** Tab value: the status string, or 'all' for the unfiltered view. */
  key: string;
  label: string;
  icon: string;
}

/** A status section on the "All" tab (or the single flat group elsewhere). */
interface PlanGroup {
  /** null for the flat (single-status tab) group — no header rendered. */
  status: ProgramAssignmentStatus | null;
  label: string;
  items: ProgramAssignment[];
}

/**
 * Client "My plans" list (`/user/plans`).
 *
 * Status filter (`p-tabs`) over a one-per-row agenda of program assignments,
 * mirroring the my-sessions surface: a dedicated `mh-my-plan-row`, a search
 * field, and (on the All tab) status section grouping. Empty state CTA points
 * to Discover — a client with no plans can't create one, so the meaningful
 * action is to find a coach.
 */
@Component({
  selector: 'mh-my-plans',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ButtonModule,
    Card,
    IconField,
    InputIcon,
    InputTextModule,
    ListEmptyState,
    SectionLabel,
    DaySeparator,
    MyPlanRow,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './my-plans.html',
  styleUrl: './my-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPlans {
  private readonly _service = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTabletDown = injectIsTabletDown();

  // Enum exposed for template comparisons — never compare against raw
  // string literals (see CLAUDE.md).
  protected readonly Status = ProgramAssignmentStatus;

  readonly items = signal<ProgramAssignment[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly statusFilter = signal<ProgramAssignmentStatus | null>(null);
  readonly searchInput = signal('');

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly tabs: StatusTab[] = [
    { key: 'all', label: 'All', icon: 'pi pi-list' },
    { key: ProgramAssignmentStatus.Active, label: 'Active', icon: 'pi pi-bolt' },
    { key: ProgramAssignmentStatus.Pending, label: 'Pending', icon: 'pi pi-clock' },
    { key: ProgramAssignmentStatus.Completed, label: 'Completed', icon: 'pi pi-check-circle' },
    { key: ProgramAssignmentStatus.Paused, label: 'Paused', icon: 'pi pi-pause-circle' },
  ];

  /** Status display order for the "All" tab section grouping. */
  private readonly _groupOrder: { status: ProgramAssignmentStatus; label: string }[] = [
    { status: ProgramAssignmentStatus.Active, label: 'Active' },
    { status: ProgramAssignmentStatus.Pending, label: 'Pending' },
    { status: ProgramAssignmentStatus.Paused, label: 'Paused' },
    { status: ProgramAssignmentStatus.Completed, label: 'Completed' },
    { status: ProgramAssignmentStatus.Cancelled, label: 'Cancelled' },
  ];

  /** Client-side search over the loaded page (program name + coach name). */
  readonly filteredItems = computed(() => {
    const q = this.searchInput().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((a) => {
      const name = a.programNameSnapshot.toLowerCase();
      const coach = `${a.instructor?.firstName ?? ''} ${a.instructor?.lastName ?? ''}`
        .trim()
        .toLowerCase();
      return name.includes(q) || coach.includes(q);
    });
  });

  /**
   * On the All tab, bucket by status in a fixed order (empty buckets dropped).
   * On a specific-status tab, return a single unlabeled group rendered flat.
   */
  readonly groupedItems = computed<PlanGroup[]>(() => {
    const all = this.filteredItems();
    if (this.statusFilter() !== null) {
      return all.length ? [{ status: null, label: '', items: all }] : [];
    }
    return this._groupOrder
      .map(({ status, label }) => ({
        status,
        label,
        items: all.filter((a) => a.status === status),
      }))
      .filter((g) => g.items.length > 0);
  });

  constructor() {
    // Reload when the status filter changes — reset to page 1. `fetch()`
    // reads `page()`, so it's wrapped in `untracked` to keep this effect
    // depending on `statusFilter` only; otherwise `loadMore()`'s page bump
    // would re-fire it and clobber pagination.
    effect(() => {
      this.statusFilter();
      this.page.set(1);
      untracked(() => this.fetch(true));
    });
  }

  // ── Tabs / search ────────────────────────────────────────────────

  /** p-tabs emits string | number; map the active key back to a status. */
  setStatus(value: string | number | undefined): void {
    this.statusFilter.set(
      value == null || value === 'all' ? null : (value as ProgramAssignmentStatus),
    );
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  clearSearch(): void {
    this.searchInput.set('');
  }

  // ── Actions ──────────────────────────────────────────────────────

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  openPlan(a: ProgramAssignment): void {
    void this._router.navigate(['/user/plans', a.id]);
  }

  goToDiscover(): void {
    void this._router.navigate(['/user/sessions/discover']);
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(replace: boolean): void {
    const query: ListAssignmentsQuery = {
      page: this.page(),
      limit: this.pageSize,
      status: this.statusFilter() ?? undefined,
    };

    if (replace) this.loading.set(true);
    else this.loadingMore.set(true);

    const settle = (): void => {
      this.loading.set(false);
      this.loadingMore.set(false);
    };

    this._service.listForClient(query).subscribe({
      next: (res: PaginatedAssignments) => {
        if (replace) this.items.set(res.items);
        else this.items.update((cur) => [...cur, ...res.items]);
        this.total.set(res.total);
        settle();
      },
      error: (err) => {
        settle();
        showApiError(
          this._messageService,
          "Couldn't load your plans",
          'Check your connection and try again.',
          err,
        );
      },
    });
  }
}
