import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ClientRequestTypes,
  ClientService,
  ClientStatusLabels,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  PendingClientLabels,
  TagSeverity,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { EditClientNotesDialog } from '../_dialogs/edit-client-notes-dialog/edit-client-notes-dialog';
import { InviteClientDialog } from '../_dialogs/invite-client-dialog/invite-client-dialog';

@Component({
  selector: 'mh-clients',
  imports: [
    DatePipe,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    BadgeModule,
    OverlayBadgeModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    InviteClientDialog,
    EditClientNotesDialog,
    RouterLink,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients implements OnInit {
  private readonly _router = inject(Router);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;
  readonly RequestTypes = ClientRequestTypes;

  lastLazyEvent: TableLazyLoadEvent = {};
  clients = signal<any[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  statusFilter = signal<InstructorClientStatus | undefined>(undefined);
  readonly statusOptions = [
    { label: 'All', value: undefined },
    { label: 'Active', value: 'ACTIVE' as InstructorClientStatus },
    // { label: 'Pending', value: 'PENDING' as InstructorClientStatus },
    { label: 'Archived', value: 'ARCHIVED' as InstructorClientStatus },
  ];

  showInviteDialog = signal(false);
  showNotesDialog = signal(false);
  editingClient = signal<InstructorClient | null>(null);

  incomingRequestsCount = signal(0);
  readonly showIncomingBanner = computed(
    () => this.incomingRequestsCount() > 0 && this.statusFilter() !== this.Statuses.Pending,
  );

  ngOnInit(): void {
    this.loadPendingCount();
  }

  loadClients() {
    this.lazyLoadClients(this.lastLazyEvent);
  }

  loadPendingCount(): void {
    this._clientService.getPendingRequestsCount().subscribe({
      next: ({ count }) => this.incomingRequestsCount.set(count),
      error: () => this.incomingRequestsCount.set(0),
    });
  }

  lazyLoadClients(event: TableLazyLoadEvent) {
    this.lastLazyEvent = event;
    this.loading.set(true);
    this._clientService.filterClients(event).subscribe({
      next: (response) => {
        this.clients.set(response.items);
        this.totalRecords.set(response.total);
        this.loading.set(false);
      },
    });
  }

  onStatusFilterChange(status: InstructorClientStatus | undefined): void {
    this.lastLazyEvent.first = 0;
    this.lastLazyEvent.rows = this.rows;
    this.lastLazyEvent.filters = {
      status: { value: status },
    };
    this.statusFilter.set(status);
    this.lazyLoadClients(this.lastLazyEvent);
  }

  // viewProfile(client: InstructorClient): void {
  //   this._router.navigate(['/coaching/clients', client.id], {
  //     state: { client },
  //   });
  // }

  goToPendingRequests() {
    this._router.navigate(['/coaching/pending-requests']);
  }

  openInviteDialog(): void {
    this.showInviteDialog.set(true);
  }

  openNotesDialog(client: InstructorClient): void {
    this.editingClient.set(client);
    this.showNotesDialog.set(true);
  }

  cancelInvitation(client: InstructorClient): void {
    const name = client.client
      ? `${client.client.firstName} ${client.client.lastName}`
      : 'this client';
    this._confirmationService.confirm({
      message: `Are you sure you want to cancel the invitation to ${name}?`,
      header: 'Cancel invitation',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.cancelInvitationRequest(client),
    });
  }

  resendInvitation(client: InstructorClient): void {
    const target = client.client
      ? `${client.client.firstName} ${client.client.lastName}`
      : (client.invitedEmail ?? 'this client');
    this._confirmationService.confirm({
      message: `Resend the invitation to ${target}?`,
      header: 'Resend invitation',
      icon: 'pi pi-send',
      accept: () => {
        this._clientService.resendInvitation(client.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Invitation resent',
              detail: 'The invitation has been resent successfully',
            });
          },
          error: (err) => {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to resend invitation',
            });
          },
        });
      },
    });
  }

  confirmArchive(client: InstructorClient): void {
    const name = client.client
      ? `${client.client.firstName} ${client.client.lastName}`
      : 'this client';
    this._confirmationService.confirm({
      message: `Are you sure you want to archive ${name}?`,
      header: 'Archive client',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.archiveClient(client),
    });
  }

  private cancelInvitationRequest(client: InstructorClient): void {
    // this._clientService.archiveClient(client.clientId).subscribe({
    //   next: () => {
    //     this._messageService.add({
    //       severity: 'success',
    //       summary: 'Client archived',
    //       detail: 'Client relationship has been archived',
    //     });
    //     this.loadClients();
    //   },
    //   error: () => {
    //     this._messageService.add({
    //       severity: 'error',
    //       summary: 'Error',
    //       detail: 'Failed to archive client',
    //     });
    //   },
    // });
  }
  private archiveClient(client: InstructorClient): void {
    this._clientService.archiveClient(client.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client archived',
          detail: 'Client relationship has been archived',
        });
        this.loadClients();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to archive client',
        });
      },
    });
  }

  confirmUnarchive(client: InstructorClient): void {
    const name = client.client
      ? `${client.client.firstName} ${client.client.lastName}`
      : 'this client';
    this._confirmationService.confirm({
      message: `Are you sure you want to unarchive ${name}?`,
      header: 'Unarchive client',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.unarchiveClient(client),
    });
  }

  private unarchiveClient(client: InstructorClient): void {
    this._clientService.unarchiveClient(client.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client unarchived',
          detail: 'Client relationship has been restored',
        });
        this.loadClients();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to unarchive client',
        });
      },
    });
  }

  acceptPendingRequest(client: InstructorClient): void {
    this._clientService.acceptRequest(client.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Request accepted',
          detail: 'Client request accepted successfully',
        });
        this.loadPendingCount();
        this.loadClients();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to accept request',
        });
      },
    });
  }

  declinePendingRequest(client: InstructorClient): void {
    this._clientService.declineRequest(client.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: 'Request declined',
          detail: 'Client request has been declined',
        });
        this.loadClients();
        this.loadPendingCount();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to decline request',
        });
      },
    });
  }

  // --- Display helpers ---

  clientName(client: InstructorClient): string {
    if (client.client) {
      return `${client.client.firstName} ${client.client.lastName}`;
    }
    if (client.invitedEmail) {
      return client.invitedEmail;
    }
    return 'Unknown';
  }

  clientEmail(client: InstructorClient): string {
    return client.client?.email || client.invitedEmail || '—';
  }

  initials(client: InstructorClient): string {
    if (client.client) {
      return client.client.firstName.charAt(0) + client.client.lastName.charAt(0);
    }
    if (client.invitedEmail) {
      return client.invitedEmail.charAt(0).toUpperCase();
    }
    return '??';
  }

  clientStatusLabel(client: InstructorClient): string {
    if (client.status !== InstructorClientStatuses.Pending)
      return ClientStatusLabels[client.status];
    if (client.requestType === ClientRequestTypes.InstructorToClient) {
      return client.client ? PendingClientLabels.Invited : PendingClientLabels.EmailSent;
    }
    return PendingClientLabels.Request;
  }

  statusSeverity(status: InstructorClientStatus): TagSeverity {
    switch (status) {
      case 'ACTIVE':
        return TagSeverity.Success;
      case 'ARCHIVED':
        return TagSeverity.Danger;
      case 'PENDING':
        return TagSeverity.Warn;
    }
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
