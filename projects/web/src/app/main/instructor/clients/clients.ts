import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import {
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  ClientRequestTypes,
  ClientStatusLabels,
  PendingClientLabels,
  ClientService,
  TagSeverity,
} from 'core';
import { InviteClientDialog } from '../_dialogs/invite-client-dialog/invite-client-dialog';
import { EditClientNotesDialog } from '../_dialogs/edit-client-notes-dialog/edit-client-notes-dialog';

@Component({
  selector: 'mh-clients',
  imports: [
    DatePipe,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    InviteClientDialog,
    EditClientNotesDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients implements OnInit {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;
  readonly RequestTypes = ClientRequestTypes;

  clients = signal<any[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  statusFilter = signal<InstructorClientStatus | undefined>(undefined);
  readonly statusOptions = [
    { label: 'All', value: undefined },
    { label: 'Active', value: 'ACTIVE' as InstructorClientStatus },
    { label: 'Pending', value: 'PENDING' as InstructorClientStatus },
    { label: 'Archived', value: 'ARCHIVED' as InstructorClientStatus },
  ];

  showInviteDialog = signal(false);
  showNotesDialog = signal(false);
  editingClient = signal<InstructorClient | null>(null);

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this._clientService
      .getClients({
        status: this.statusFilter(),
        page: this.currentPage(),
        limit: this.rows,
      })
      .subscribe({
        next: (response) => {
          this.clients.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load clients',
          });
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadClients();
  }

  onStatusFilterChange(status: InstructorClientStatus | undefined): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadClients();
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
      : client.invitedEmail ?? 'this client';
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
