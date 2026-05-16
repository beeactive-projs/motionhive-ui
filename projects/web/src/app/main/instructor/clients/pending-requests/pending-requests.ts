import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ClientRequestType,
  ClientRequestTypes,
  ClientService,
  InstructorClient,
  InstructorClientStatuses,
  PendingClientLabels,
  showApiError,
  TagSeverity,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { UserInfo } from '../../../../_shared/components/user-info/user-info';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InviteClientDialog } from '../../_dialogs/invite-client-dialog/invite-client-dialog';

type RequestDirection = 'INCOMING' | 'OUTGOING';

@Component({
  selector: 'mh-pending-requests',
  imports: [
    DatePipe,
    ButtonModule,
    TableModule,
    TagModule,
    UserInfo,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    InviteClientDialog,
    RouterLink,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './pending-requests.html',
  styleUrl: './pending-requests.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingRequests {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

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

  readonly Statuses = InstructorClientStatuses;
  readonly RequestTypes = ClientRequestTypes;

  lastLazyEvent: TableLazyLoadEvent = {};
  requests = signal<InstructorClient[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  showInviteDialog = signal(false);

  readonly rows = 10;
  currentPage = signal(1);

  typeFilter = signal<ClientRequestType | undefined>(undefined);
  readonly typeOptions: { label: string; value: ClientRequestType | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Incoming', value: ClientRequestTypes.ClientToInstructor as ClientRequestType },
    { label: 'Outgoing', value: ClientRequestTypes.InstructorToClient as ClientRequestType },
  ];

  loadRequests(): void {
    this.lazyLoadRequests(this.lastLazyEvent);
  }

  goBack(): void {
    this._router.navigate(['/coaching/clients']);
  }

  lazyLoadRequests(event: TableLazyLoadEvent): void {
    this.lastLazyEvent = event;
    this.loading.set(true);
    this._clientService.filterPendingRequests(event).subscribe({
      next: (response) => {
        this.requests.set(response.items);
        this.totalRecords.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Error', 'Failed to load pending requests', err);
      },
    });
  }

  onTypeFilterChange(type: ClientRequestType | undefined): void {
    this.lastLazyEvent.first = 0;
    this.lastLazyEvent.rows = this.rows;
    this.lastLazyEvent.filters = type ? { type: { value: type, matchMode: 'equals' } } : {};
    this.typeFilter.set(type);
    this.lazyLoadRequests(this.lastLazyEvent);
  }

  openInviteDialog(): void {
    this.showInviteDialog.set(true);
  }

  // --- Actions ---

  acceptRequest(row: InstructorClient): void {
    this._clientService.acceptRequest(row.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Request accepted',
          detail: 'Client request accepted successfully',
        });
        this.loadRequests();
      },
      error: (err) => showApiError(this._messageService, 'Error', 'Failed to accept request', err),
    });
  }

  declineRequest(row: InstructorClient): void {
    this._clientService.declineRequest(row.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: 'Request declined',
          detail: 'Client request has been declined',
        });
        this.loadRequests();
      },
      error: (err) => showApiError(this._messageService, 'Error', 'Failed to decline request', err),
    });
  }

  cancelRequest(row: InstructorClient): void {
    const target = row.client
      ? `${row.client.firstName} ${row.client.lastName}`
      : (row.invitedEmail ?? 'this client');
    this._confirmationService.confirm({
      message: `Are you sure you want to cancel the invitation to ${target}?`,
      header: 'Cancel invitation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._clientService.cancelRequest(row.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Invitation cancelled',
              detail: 'The invitation has been cancelled',
            });
            this.loadRequests();
          },
          error: (err) =>
            showApiError(this._messageService, 'Error', 'Failed to cancel invitation', err),
        });
      },
    });
  }

  resendInvitation(row: InstructorClient): void {
    const target = row.client
      ? `${row.client.firstName} ${row.client.lastName}`
      : (row.invitedEmail ?? 'this client');
    this._confirmationService.confirm({
      message: `Resend the invitation to ${target}?`,
      header: 'Resend invitation',
      icon: 'pi pi-send',
      accept: () => {
        this._clientService.resendInvitation(row.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Invitation resent',
              detail: 'The invitation has been resent successfully',
            });
            this.loadRequests();
          },
          error: (err) =>
            showApiError(this._messageService, 'Error', 'Failed to resend invitation', err),
        });
      },
    });
  }

  // --- Display helpers ---

  clientName(row: InstructorClient): string {
    if (row.client) {
      return `${row.client.firstName} ${row.client.lastName}`;
    }
    if (row.invitedEmail) {
      return row.invitedEmail;
    }
    return 'Unknown';
  }

  clientEmail(row: InstructorClient): string {
    return row.client?.email || row.invitedEmail || '—';
  }

  initials(row: InstructorClient): string {
    if (row.client) {
      return row.client.firstName.charAt(0) + row.client.lastName.charAt(0);
    }
    if (row.invitedEmail) {
      return row.invitedEmail.charAt(0).toUpperCase();
    }
    return '??';
  }

  direction(row: InstructorClient): RequestDirection {
    return row.requestType === this.RequestTypes.InstructorToClient ? 'OUTGOING' : 'INCOMING';
  }

  directionLabel(row: InstructorClient): string {
    return this.direction(row) === 'OUTGOING' ? 'Outgoing' : 'Incoming';
  }

  directionSeverity(row: InstructorClient): TagSeverity {
    return this.direction(row) === 'OUTGOING' ? TagSeverity.Info : TagSeverity.Warn;
  }

  typeLabel(row: InstructorClient): string {
    if (row.requestType === this.RequestTypes.InstructorToClient) {
      return row.client ? PendingClientLabels.Invited : PendingClientLabels.EmailSent;
    }
    return PendingClientLabels.Request;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
