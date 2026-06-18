import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';

import { MobileFab } from '../../../_shared/components/mobile-fab/mobile-fab';
import {
  ListProgramsQuery,
  PaginatedPrograms,
  Program,
  ProgramService,
  ProgramStatus,
  TagSeverity,
  UpdateProgramPayload,
  apiErrorMessage,
  injectIsMobile,
  injectIsTablet,
  injectIsTabletDown,
  showApiError,
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
    ConfirmDialog,
    IconField,
    InputIcon,
    InputTextModule,
    Menu,
    MessageModule,
    SkeletonModule,
    Tag,
    Toast,
    ListEmptyState,
    MobileFab,
    ProgramFormDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Programs {
  private readonly _programService = inject(ProgramService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _messageService = inject(MessageService);

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
  /** When set → the form dialog opens in edit mode; null → create mode. */
  readonly editTarget = signal<Program | null>(null);

  /** IDs with an in-flight status/delete mutation — drives the kebab spinner. */
  readonly mutatingIds = signal<Set<string>>(new Set());

  /** Status-aware action sheet for the card kebab, rebuilt per open. */
  readonly cardMenuItems = signal<MenuItem[]>([]);
  private readonly _cardMenu = viewChild<Menu>('cardMenu');

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
    this.editTarget.set(null);
    this.formDialogOpen.set(true);
  }

  openEdit(program: Program): void {
    this.editTarget.set(program);
    this.formDialogOpen.set(true);
  }

  retry(): void {
    this.fetch(true);
  }

  /** Bubbled up from the form dialog on create OR edit. */
  onSaved(p: Program): void {
    const exists = this.items().some((x) => x.id === p.id);
    this.items.update((cur) =>
      exists
        ? cur.map((x) => (x.id === p.id ? { ...x, ...p } : x))
        : // Prepend the new program so the instructor sees it without
          // waiting for a refetch; the next filter change resets the list.
          [p, ...cur],
    );
    if (!exists) this.total.update((t) => t + 1);
    this.editTarget.set(null);
    this.formDialogOpen.set(false);
  }

  // ── Card actions (kebab menu) ────────────────────────────────────

  openCardMenu(event: MouseEvent, program: Program): void {
    // The card is a router link — stop the click from navigating.
    event.stopPropagation();
    event.preventDefault();
    this.cardMenuItems.set(this._buildMenu(program));
    this._cardMenu()?.toggle(event);
  }

  /** Draft → publish. Non-destructive, no confirm. */
  publish(program: Program): void {
    this._setStatus(program, ProgramStatus.Published, 'Program published');
  }

  /** Archived → restore to draft. Non-destructive, no confirm. */
  restore(program: Program): void {
    this._setStatus(program, ProgramStatus.Draft, 'Program restored to draft');
  }

  confirmArchive(program: Program): void {
    this._confirmationService.confirm({
      header: 'Archive program?',
      message: `"${program.name}" will be hidden from your active list. Existing client assignments keep their copy — you just won't be able to assign it to new clients until you restore it.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Archive',
      acceptButtonProps: { severity: 'warn' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._setStatus(program, ProgramStatus.Archived, 'Program archived'),
    });
  }

  confirmDelete(program: Program): void {
    this._confirmationService.confirm({
      header: 'Delete program?',
      message: `<strong>${program.name}</strong> will be removed from your library.<br /> Existing client assignments keep their copy, but you won't be able to assign it to new clients.`,
      acceptLabel: 'Delete',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteProgram(program),
    });
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

  /** Status-aware menu model. Edit + one status transition + delete. */
  private _buildMenu(p: Program): MenuItem[] {
    const items: MenuItem[] = [
      { label: 'Edit', icon: 'pi pi-pencil', command: () => this.openEdit(p) },
    ];
    switch (p.status) {
      case ProgramStatus.Draft:
        items.push({
          label: 'Publish',
          icon: 'pi pi-check-circle',
          command: () => this.publish(p),
        });
        break;
      case ProgramStatus.Published:
        items.push({
          label: 'Archive…',
          icon: 'pi pi-inbox',
          command: () => this.confirmArchive(p),
        });
        break;
      case ProgramStatus.Archived:
        items.push({
          label: 'Restore to draft',
          icon: 'pi pi-replay',
          command: () => this.restore(p),
        });
        break;
    }
    items.push(
      { separator: true },
      {
        label: 'Delete…',
        icon: 'pi pi-trash',
        command: () => this.confirmDelete(p),
      },
    );
    return items;
  }

  private _setStatus(program: Program, status: ProgramStatus, successSummary: string): void {
    if (this.mutatingIds().has(program.id)) return;
    this._setMutating(program.id, true);
    const payload: UpdateProgramPayload = { status };
    this._programService.update(program.id, payload).subscribe({
      next: (updated) => {
        this._setMutating(program.id, false);
        this._applyStatusUpdate(updated);
        this._messageService.add({
          severity: 'success',
          summary: successSummary,
          detail: updated.name,
          life: 2500,
        });
      },
      error: (err) => {
        this._setMutating(program.id, false);
        showApiError(this._messageService, "Couldn't update program", 'Please try again.', err);
      },
    });
  }

  /**
   * Reflect a status change in the list. If the new status no longer
   * matches the active filter, drop the card from view (and the count);
   * otherwise patch it in place.
   */
  private _applyStatusUpdate(updated: Program): void {
    const filter = this.statusFilter();
    if (filter && updated.status !== filter) {
      this.items.update((cur) => cur.filter((x) => x.id !== updated.id));
      this.total.update((t) => Math.max(0, t - 1));
    } else {
      this.items.update((cur) => cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    }
  }

  private _deleteProgram(program: Program): void {
    if (this.mutatingIds().has(program.id)) return;
    this._setMutating(program.id, true);
    this._programService.remove(program.id).subscribe({
      next: () => {
        this._setMutating(program.id, false);
        this.items.update((cur) => cur.filter((x) => x.id !== program.id));
        this.total.update((t) => Math.max(0, t - 1));
        this._messageService.add({
          severity: 'success',
          summary: 'Program deleted',
          detail: program.name,
          life: 2500,
        });
      },
      error: (err) => {
        this._setMutating(program.id, false);
        showApiError(this._messageService, "Couldn't delete program", 'Please try again.', err);
      },
    });
  }

  private _setMutating(id: string, on: boolean): void {
    this.mutatingIds.update((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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
        this.error.set(apiErrorMessage(err, 'Check your connection and try again.'));
        settle();
      },
    });
  }
}
