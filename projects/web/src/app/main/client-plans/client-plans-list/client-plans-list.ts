import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { Toast } from 'primeng/toast';

import {
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  showApiError,
} from 'core';

interface StatusTab {
  value: ProgramAssignmentStatus | null;
  label: string;
}

/**
 * Client "My plans" list (S9 in the Claude Design package).
 *
 * Status segmented control (PrimeNG selectbutton) + card grid with
 * the design's atoms (`mh-plan-card`, `mh-tag`, `mh-progress`,
 * instructor avatar). Empty state CTA points to Discover — a client
 * with no plans can't create one, so the meaningful action is to find
 * an instructor.
 */
@Component({
  selector: 'mh-client-plans-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    SelectButton,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './client-plans-list.html',
  styleUrl: './client-plans-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPlansList {
  private readonly _service = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  readonly items = signal<ProgramAssignment[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly statusFilter = signal<ProgramAssignmentStatus | null>(null);

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly statusOptions: StatusTab[] = [
    { value: null, label: 'All' },
    { value: ProgramAssignmentStatus.Active, label: 'Active' },
    { value: ProgramAssignmentStatus.Pending, label: 'Pending' },
    { value: ProgramAssignmentStatus.Completed, label: 'Completed' },
    { value: ProgramAssignmentStatus.Paused, label: 'Paused' },
  ];

  constructor() {
    effect(() => {
      this.statusFilter();
      this.page.set(1);
      this.fetch(true);
    });
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
    if (!i) return 'your instructor';
    return `${i.firstName} ${i.lastName}`.trim() || 'your instructor';
  }

  /** Map status → tag modifier the SCSS knows about. */
  statusTagClass(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'mh-tag--warn';
      case ProgramAssignmentStatus.Completed:
        return 'mh-tag--success';
      case ProgramAssignmentStatus.Paused:
        return 'mh-tag--muted';
      case ProgramAssignmentStatus.Cancelled:
        return 'mh-tag--danger';
      default:
        return 'mh-tag--info';
    }
  }

  statusIcon(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'pi pi-spinner';
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

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  goToDiscover(): void {
    this._router.navigate(['/sessions/discover']);
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
