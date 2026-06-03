import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  showApiError,
} from 'core';

/**
 * Client-side "My plans" — list of program assignments the logged-in
 * user has been given by their instructors.
 *
 * Mirrors the instructor programs list shape (status tabs + card grid
 * + load more) so the visual language stays consistent across the two
 * surfaces. The detail view + logging UI ship in later slices.
 */
@Component({
  selector: 'mh-my-plans',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TitleCasePipe,
    ButtonModule,
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

  // ── State ────────────────────────────────────────────────────────

  readonly items = signal<ProgramAssignment[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly statusFilter = signal<ProgramAssignmentStatus | null>(null);

  // ── Derived ──────────────────────────────────────────────────────

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly statusTabs: {
    value: ProgramAssignmentStatus | null;
    label: string;
  }[] = [
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

  // ── Actions ──────────────────────────────────────────────────────

  setStatus(value: ProgramAssignmentStatus | null): void {
    this.statusFilter.set(value);
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  statusTone(s: ProgramAssignmentStatus): string {
    switch (s) {
      case ProgramAssignmentStatus.Active:
        return 'active';
      case ProgramAssignmentStatus.Completed:
        return 'completed';
      case ProgramAssignmentStatus.Paused:
        return 'paused';
      case ProgramAssignmentStatus.Cancelled:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  instructorName(a: ProgramAssignment): string {
    const i = a.instructor;
    if (!i) return 'your instructor';
    return `${i.firstName} ${i.lastName}`.trim() || 'your instructor';
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
