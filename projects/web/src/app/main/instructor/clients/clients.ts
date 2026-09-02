import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  clientDisplayName,
  clientEmail as clientEmailOf,
  ClientService,
  clientStatusLabel as clientStatusLabelOf,
  injectIsMobile,
  injectIsTablet,
  injectIsTabletDown,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  isOpenableClient,
  showApiError,
  TagSeverity,
} from 'core';
import { MobileFab } from '../../../_shared/components/mobile-fab/mobile-fab';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataView } from 'primeng/dataview';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { take } from 'rxjs';
import { EditClientNotesDialog } from '../_dialogs/edit-client-notes-dialog/edit-client-notes-dialog';
import { InviteClientDialog } from '../_dialogs/invite-client-dialog/invite-client-dialog';
import { UserInfo } from '../../../_shared/components/user-info/user-info';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { CoachRoster } from './roster/roster';

/** The two ways a coach looks at the same list of people. */
type ClientsLens = 'attention' | 'all';

@Component({
  selector: 'mh-clients',
  imports: [
    DatePipe,
    ButtonDirective,
    TableModule,
    TagModule,
    UserInfo,
    OverlayBadgeModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    DataView,
    InviteClientDialog,
    EditClientNotesDialog,
    ListEmptyState,
    FormsModule,
    CoachRoster,
    SelectButton,
    MobileFab,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients implements OnInit {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();
  /** Tablet or smaller — the "compact" surface (smaller text, condensed copy). */
  protected readonly isTabletDown = injectIsTabletDown();

  lastLazyEvent: TableLazyLoadEvent = {};
  clients = signal<InstructorClient[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  // Mobile infinite-scroll state — the list accumulates pages instead of
  // paginating, and a bottom sentinel pulls the next page as it scrolls in.
  mobileClients = signal<InstructorClient[]>([]);
  loadingMore = signal(false);
  private readonly _mobilePage = signal(0);
  private _mobileInitialized = false;

  private readonly _scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _io?: IntersectionObserver;

  readonly rows = 10;

  /**
   * Which lens is showing. Defaults to the roster: a coach opening this
   * page wants to know who is slipping, not to read an alphabetical
   * directory. `?view=all` deep-links the table so the switch survives
   * a refresh or a shared link.
   */
  readonly lens = signal<ClientsLens>('attention');

  readonly lensOptions: { label: string; value: ClientsLens }[] = [
    { label: 'Needs attention', value: 'attention' },
    { label: 'All clients', value: 'all' },
  ];

  statusFilter = signal<InstructorClientStatus | undefined>(undefined);
  readonly statusOptions: { label: string; value: InstructorClientStatus | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Active', value: InstructorClientStatuses.Active },
    { label: 'Archived', value: InstructorClientStatuses.Archived },
  ];

  showInviteDialog = signal(false);
  showNotesDialog = signal(false);
  editingClient = signal<InstructorClient | null>(null);

  incomingRequestsCount = signal(0);

  constructor() {
    // First time the layout drops to tablet-or-smaller, kick off the initial page.
    effect(() => {
      if (this.isTabletDown() && !this._mobileInitialized) {
        this._mobileInitialized = true;
        this.loadMobilePage(true);
      }
    });

    // Observe the bottom sentinel so reaching the end of the list pulls the
    // next page (infinite scroll). Re-reading mobileClients() re-attaches the
    // observer after each append, forcing a fresh intersection check when the
    // sentinel is still on screen.
    effect(() => {
      this.mobileClients();
      const el = this._scrollSentinel()?.nativeElement;
      this._io?.disconnect();
      if (!el || typeof IntersectionObserver === 'undefined') return;
      this._io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) this.loadMoreMobile();
        },
        { rootMargin: '200px' },
      );
      this._io.observe(el);
    });

    inject(DestroyRef).onDestroy(() => this._io?.disconnect());
  }

  ngOnInit(): void {
    this._readLensFromUrl();
    this.loadPendingCount();
  }

  loadClients(): void {
    if (this.isTabletDown()) {
      this.loadMobilePage(true);
    } else {
      this.lazyLoadClients(this.lastLazyEvent);
    }
  }

  private loadMobilePage(reset: boolean): void {
    if (reset) {
      this._mobilePage.set(0);
      this.mobileClients.set([]);
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    const event: TableLazyLoadEvent = {
      first: this._mobilePage() * this.rows,
      rows: this.rows,
      sortField: 'client.firstName',
      sortOrder: 1,
      filters: { status: { value: this.statusFilter() } },
    };

    this._clientService
      .filterClients(event)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.mobileClients.update((list) =>
            reset ? response.items : [...list, ...response.items],
          );
          this.totalRecords.set(response.total);
          this._mobilePage.update((p) => p + 1);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  private loadMoreMobile(): void {
    if (this.loading() || this.loadingMore()) return;
    if (this.mobileClients().length >= this.totalRecords()) return;
    this.loadMobilePage(false);
  }

  loadPendingCount(): void {
    this._clientService
      .getPendingRequestsCount()
      .pipe(take(1))
      .subscribe({
        next: ({ count }) => this.incomingRequestsCount.set(count),
        error: () => this.incomingRequestsCount.set(0),
      });
  }

  lazyLoadClients(event: TableLazyLoadEvent): void {
    this.lastLazyEvent = event;
    this.loading.set(true);
    this._clientService
      .filterClients(event)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.clients.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private _readLensFromUrl(): void {
    if (this._route.snapshot.queryParamMap.get('view') === 'all') {
      this.lens.set('all');
    }
  }

  setLens(lens: ClientsLens): void {
    if (lens === this.lens()) return;
    this.lens.set(lens);
    // Reflected in the URL, not stored: the view a coach is looking at
    // should be shareable and survive a refresh.
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { view: lens === 'all' ? 'all' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Whether this row has a profile to open — see `isOpenableClient` in core. */
  isOpenable(client: InstructorClient): boolean {
    return isOpenableClient(client);
  }

  /** Open the full profile — plans, workouts, progress, sessions. */
  openClient(client: InstructorClient): void {
    if (!this.isOpenable(client)) return;
    this._router.navigate(['/coaching/clients', client.clientId]);
  }

  onStatusFilterChange(status: InstructorClientStatus | undefined): void {
    this.statusFilter.set(status);
    if (this.isTabletDown()) {
      this.loadMobilePage(true);
      return;
    }
    this.lastLazyEvent.first = 0;
    this.lastLazyEvent.rows = this.rows;
    this.lastLazyEvent.filters = { status: { value: status } };
    this.lazyLoadClients(this.lastLazyEvent);
  }

  goToPendingRequests(): void {
    this._router.navigate(['/coaching/pending-requests']);
  }

  openInviteDialog(): void {
    this.showInviteDialog.set(true);
  }

  openNotesDialog(client: InstructorClient): void {
    this.editingClient.set(client);
    this.showNotesDialog.set(true);
  }

  confirmArchive(client: InstructorClient): void {
    this._confirmationService.confirm({
      header: 'Archive client',
      message: `Are you sure you want to archive <strong>${this.clientName(client)}</strong>?`,
      acceptIcon: 'pi pi-inbox',
      acceptButtonProps: {
        label: 'Yes, archive',
        severity: 'danger',
        iconPos: 'left',
      },
      rejectButtonProps: { text: 'true', severity: 'contrast' },
      accept: () => this.archiveClient(client),
    });
  }

  private archiveClient(client: InstructorClient): void {
    this._clientService
      .archiveClient(client.clientId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'Client archived',
            detail: 'Client relationship has been archived',
          });
          this.loadClients();
        },
        error: (err) =>
          showApiError(this._messageService, 'Error', 'Failed to archive client', err),
      });
  }

  confirmUnarchive(client: InstructorClient): void {
    this._confirmationService.confirm({
      header: 'Unarchive client',
      message: `Are you sure you want to unarchive <strong>${this.clientName(client)}</strong>?`,
      acceptIcon: 'pi pi-inbox',
      acceptButtonProps: { label: 'Yes, unarchive', iconPos: 'left' },
      rejectButtonProps: { text: 'true', severity: 'contrast' },
      accept: () => this.unarchiveClient(client),
    });
  }

  private unarchiveClient(client: InstructorClient): void {
    this._clientService
      .unarchiveClient(client.clientId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'Client unarchived',
            detail: 'Client relationship has been restored',
          });
          this.loadClients();
        },
        error: (err) =>
          showApiError(this._messageService, 'Error', 'Failed to unarchive client', err),
      });
  }

  // --- Display helpers (shared with mobile through core's client.utils) ---

  clientName(client: InstructorClient): string {
    return clientDisplayName(client, 'this client');
  }

  clientEmail(client: InstructorClient): string {
    return clientEmailOf(client);
  }

  clientStatusLabel(client: InstructorClient): string {
    return clientStatusLabelOf(client);
  }

  statusSeverity(status: InstructorClientStatus): TagSeverity {
    switch (status) {
      case InstructorClientStatuses.Active:
        return TagSeverity.Success;
      case InstructorClientStatuses.Archived:
        return TagSeverity.Danger;
      case InstructorClientStatuses.Pending:
        return TagSeverity.Warn;
    }
  }
}
