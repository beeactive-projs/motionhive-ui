import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  clientDisplayName,
  clientEmail as clientEmailOf,
  ClientRequestType,
  ClientRequestTypes,
  ClientService,
  clientStatusLabel,
  injectIsMobile,
  injectIsTablet,
  injectIsTabletDown,
  InstructorClient,
  escapeHtml,
  showApiError,
} from 'core';
import { MobileFab } from '../../../../_shared/components/mobile-fab/mobile-fab';
import { ConfirmationService, MenuItem, MessageService, SelectItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonDirective } from 'primeng/button';
import { UserInfo } from '../../../../_shared/components/user-info/user-info';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataView } from 'primeng/dataview';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { take } from 'rxjs';
import { InviteClientDialog } from '../../_dialogs/invite-client-dialog/invite-client-dialog';

@Component({
  selector: 'mh-pending-requests',
  imports: [
    DatePipe,
    BreadcrumbModule,
    ButtonDirective,
    TableModule,
    TagModule,
    UserInfo,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    DataView,
    TooltipModule,
    InviteClientDialog,
    ListEmptyState,
    MobileFab,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './pending-requests.html',
  styleUrl: './pending-requests.scss',
})
export class PendingRequests {
  private readonly _router = inject(Router);

  private readonly _route = inject(ActivatedRoute);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

  // Email links (e.g. "New client request") include ?requestId=<id> so we
  // can scroll-highlight the row the instructor came here to act on.
  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });
  readonly highlightedRequestId = computed(() => this._queryParams().get('requestId'));
  private readonly _scrollToHighlighted = effect(() => {
    const id = this.highlightedRequestId();
    if (!id || this.loading()) return;
    queueMicrotask(() => {
      const el = document.getElementById(`request-row-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  readonly RequestTypes = ClientRequestTypes;

  readonly breadcrumbItems: MenuItem[] = [
    { label: this._translateService.instant('nav.clients'), routerLink: '/coaching/clients' },
    { label: this._translateService.instant('clients.pendingRequests.title') },
  ];

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();
  /** Tablet or smaller — the "compact" surface (smaller text, condensed copy). */
  protected readonly isTabletDown = injectIsTabletDown();

  lastLazyEvent: TableLazyLoadEvent = {};
  requests = signal<InstructorClient[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  showInviteDialog = signal(false);

  // Mobile infinite-scroll state — the list accumulates pages instead of
  // paginating, and a bottom sentinel pulls the next page as it scrolls in.
  mobileRequests = signal<InstructorClient[]>([]);
  loadingMore = signal(false);
  private readonly _mobilePage = signal(0);
  private _mobileInitialized = false;

  private readonly _scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _io?: IntersectionObserver;

  readonly rows = 10;

  typeFilter = signal<ClientRequestType | undefined>(undefined);
  /** Labels are translation keys — the template translates them. */
  readonly typeOptions: SelectItem<ClientRequestType | undefined>[] = [
    { label: 'common.all', value: undefined },
    { label: 'clients.pendingRequests.type.incoming', value: ClientRequestTypes.ClientToInstructor },
    { label: 'clients.pendingRequests.type.outgoing', value: ClientRequestTypes.InstructorToClient },
  ];

  constructor() {
    // First time the layout drops to tablet-or-smaller, kick off the initial page.
    effect(() => {
      if (this.isTabletDown() && !this._mobileInitialized) {
        this._mobileInitialized = true;
        this.loadMobilePage(true);
      }
    });

    // Observe the bottom sentinel so reaching the end of the list pulls the
    // next page (infinite scroll). Re-reading mobileRequests() re-attaches the
    // observer after each append, forcing a fresh intersection check when the
    // sentinel is still on screen.
    effect(() => {
      this.mobileRequests();
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

  loadRequests(): void {
    if (this.isTabletDown()) {
      this.loadMobilePage(true);
    } else {
      this.lazyLoadRequests(this.lastLazyEvent);
    }
  }

  private loadMobilePage(reset: boolean): void {
    if (reset) {
      this._mobilePage.set(0);
      this.mobileRequests.set([]);
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    const event: TableLazyLoadEvent = {
      first: this._mobilePage() * this.rows,
      rows: this.rows,
      sortField: 'createdAt',
      sortOrder: -1,
      filters: this.typeFilter() ? { type: { value: this.typeFilter(), matchMode: 'equals' } } : {},
    };

    this._clientService
      .filterPendingRequests(event)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.mobileRequests.update((list) =>
            reset ? response.items : [...list, ...response.items],
          );
          this.totalRecords.set(response.total);
          this._mobilePage.update((p) => p + 1);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this._showError('clients.toast.loadRequestsFailed', err);
        },
      });
  }

  private loadMoreMobile(): void {
    if (this.loading() || this.loadingMore()) return;
    if (this.mobileRequests().length >= this.totalRecords()) return;
    this.loadMobilePage(false);
  }

  lazyLoadRequests(event: TableLazyLoadEvent): void {
    this.lastLazyEvent = event;
    this.loading.set(true);
    this._clientService
      .filterPendingRequests(event)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.requests.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this._showError('clients.toast.loadRequestsFailed', err);
        },
      });
  }

  onTypeFilterChange(type: ClientRequestType | undefined): void {
    this.typeFilter.set(type);
    if (this.isTabletDown()) {
      this.loadMobilePage(true);
      return;
    }
    this.lastLazyEvent.first = 0;
    this.lastLazyEvent.rows = this.rows;
    this.lastLazyEvent.filters = type ? { type: { value: type, matchMode: 'equals' } } : {};
    this.lazyLoadRequests(this.lastLazyEvent);
  }

  openInviteDialog(): void {
    this.showInviteDialog.set(true);
  }

  goToClients(): void {
    this._router.navigate(['/coaching/clients']);
  }

  // --- Actions ---

  acceptRequest(row: InstructorClient): void {
    this._clientService
      .acceptRequest(row.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('clients.toast.accepted.summary'),
            detail: this._translateService.instant('clients.toast.accepted.detail'),
          });
          this.loadRequests();
        },
        error: (err) => this._showError('clients.toast.acceptFailed', err),
      });
  }

  declineRequest(row: InstructorClient): void {
    this._clientService
      .declineRequest(row.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'info',
            summary: this._translateService.instant('clients.toast.declined.summary'),
            detail: this._translateService.instant('clients.toast.declined.detail'),
          });
          this.loadRequests();
        },
        error: (err) => this._showError('clients.toast.declineFailed', err),
      });
  }

  cancelRequest(row: InstructorClient): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('clients.confirm.cancelInvitation.header'),
      message: this._translateService.instant('clients.confirm.cancelInvitation.message', {
        name: `<strong>${escapeHtml(this.clientName(row))}</strong>`,
      }),
      acceptIcon: 'pi pi-times',
      acceptButtonProps: {
        label: this._translateService.instant('clients.confirm.cancelInvitation.accept'),
        severity: 'danger',
        iconPos: 'left',
      },
      rejectButtonProps: { text: 'true', severity: 'contrast' },
      accept: () => {
        this._clientService
          .cancelRequest(row.id)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this._messageService.add({
                severity: 'success',
                summary: this._translateService.instant('clients.toast.invitationCancelled.summary'),
                detail: this._translateService.instant('clients.toast.invitationCancelled.detail'),
              });
              this.loadRequests();
            },
            error: (err) => this._showError('clients.toast.cancelInvitationFailed', err),
          });
      },
    });
  }

  resendInvitation(row: InstructorClient): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('clients.confirm.resendInvitation.header'),
      message: this._translateService.instant('clients.confirm.resendInvitation.message', {
        name: `<strong>${escapeHtml(this.clientName(row))}</strong>`,
      }),
      acceptIcon: 'pi pi-send',
      acceptButtonProps: {
        label: this._translateService.instant('clients.confirm.resendInvitation.accept'),
        iconPos: 'left',
      },
      rejectButtonProps: { text: 'true', severity: 'contrast' },
      accept: () => {
        this._clientService
          .resendInvitation(row.id)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this._messageService.add({
                severity: 'success',
                summary: this._translateService.instant('clients.toast.invitationResent.summary'),
                detail: this._translateService.instant('clients.toast.invitationResent.detail'),
              });
              this.loadRequests();
            },
            error: (err) => this._showError('clients.toast.resendInvitationFailed', err),
          });
      },
    });
  }

  /** Error toast with the generic "Error" summary and a feature fallback detail. */
  private _showError(fallbackKey: string, err: unknown): void {
    showApiError(
      this._messageService,
      this._translateService.instant('toast.summary.error'),
      this._translateService.instant(fallbackKey),
      err,
    );
  }

  // --- Display helpers (shared with mobile through core's client.utils) ---

  clientName(row: InstructorClient): string {
    return clientDisplayName(row, this._translateService.instant('clients.common.thisClient'));
  }

  clientEmail(row: InstructorClient): string {
    return clientEmailOf(row);
  }

  isIncoming(row: InstructorClient): boolean {
    return row.requestType !== this.RequestTypes.InstructorToClient;
  }

  /** Every row here is PENDING, so the status label is the type label. */
  typeLabel(row: InstructorClient): string {
    return clientStatusLabel(row);
  }
}
