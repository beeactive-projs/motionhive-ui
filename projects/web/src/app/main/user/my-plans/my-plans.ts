import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ProgressBar } from 'primeng/progressbar';
import { Skeleton } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';

import {
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  TagSeverity,
  injectIsMobile,
  showApiError,
} from 'core';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';

interface StatusTab {
  /** Tab value: the status string, or 'all' for the unfiltered view. */
  key: string;
  label: string;
  icon: string;
}

/**
 * Client "My plans" list (`/user/plans`).
 *
 * Status filter (`p-tabs`) over a card grid of program assignments,
 * built from the shared agenda vocabulary (p-card, p-avatar,
 * p-progressbar, p-tag) so it matches the my-sessions / my-workouts
 * surfaces. Empty state CTA points to Discover — a client with no plans
 * can't create one, so the meaningful action is to find a coach.
 */
@Component({
  selector: 'mh-my-plans',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    HexAvatar,
    ButtonModule,
    Card,
    ListEmptyState,
    ProgressBar,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
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

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly tabs: StatusTab[] = [
    { key: 'all', label: 'All', icon: 'pi pi-list' },
    { key: ProgramAssignmentStatus.Active, label: 'Active', icon: 'pi pi-bolt' },
    { key: ProgramAssignmentStatus.Pending, label: 'Pending', icon: 'pi pi-clock' },
    { key: ProgramAssignmentStatus.Completed, label: 'Completed', icon: 'pi pi-check-circle' },
    { key: ProgramAssignmentStatus.Paused, label: 'Paused', icon: 'pi pi-pause-circle' },
  ];

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

  // ── Tabs ─────────────────────────────────────────────────────────

  /** p-tabs emits string | number; map the active key back to a status. */
  setStatus(value: string | number | undefined): void {
    this.statusFilter.set(
      value == null || value === 'all'
        ? null
        : (value as ProgramAssignmentStatus),
    );
  }

  // ── Template helpers ─────────────────────────────────────────────

  instructorInitials(a: ProgramAssignment): string {
    const i = a.instructor;
    if (!i) return '?';
    const f = (i.firstName?.[0] ?? '').toUpperCase();
    const l = (i.lastName?.[0] ?? '').toUpperCase();
    return `${f}${l}` || '?';
  }

  instructorName(a: ProgramAssignment): string {
    const i = a.instructor;
    if (!i) return 'your coach';
    return `${i.firstName} ${i.lastName}`.trim() || 'your coach';
  }

  /**
   * Status → tag severity. Neutral/semantic only — honey/amber is
   * reserved for actions, never status (see CLAUDE.md brand rules).
   */
  statusSeverity(s: ProgramAssignmentStatus): TagSeverity {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return TagSeverity.Info;
      case ProgramAssignmentStatus.Completed:
        return TagSeverity.Success;
      case ProgramAssignmentStatus.Cancelled:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }

  statusIcon(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'pi pi-bolt';
      case ProgramAssignmentStatus.Completed:
        return 'pi pi-check-circle';
      case ProgramAssignmentStatus.Paused:
        return 'pi pi-pause';
      case ProgramAssignmentStatus.Cancelled:
        return 'pi pi-times-circle';
      default:
        return 'pi pi-clock';
    }
  }

  statusLabel(s: ProgramAssignmentStatus): string {
    return s.charAt(0) + s.slice(1).toLowerCase();
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
