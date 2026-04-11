import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
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
  ClientRequest,
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

  clients = signal<InstructorClient[]>([]);
  totalRecords = signal(0);
  loading = signal(true);
  pendingRequests = signal<ClientRequest[]>([]);

  readonly rows = 10;
  currentPage = signal(1);

  // Status filter
  statusFilter = signal<InstructorClientStatus | undefined>(undefined);
  readonly statusOptions = [
    { label: 'All', value: undefined },
    { label: 'Active', value: 'ACTIVE' as InstructorClientStatus },
    { label: 'Pending', value: 'PENDING' as InstructorClientStatus },
    { label: 'Archived', value: 'ARCHIVED' as InstructorClientStatus },
  ];

  // Dialog visibility
  showInviteDialog = signal(false);
  showNotesDialog = signal(false);
  editingClient = signal<InstructorClient | null>(null);

  // Pending requests count
  pendingCount = computed(() => this.pendingRequests().length);

  ngOnInit(): void {
    // this.loadClients();
    this.loadPendingRequests();
  }

  loadClients(): void {
    this.loading.set(true);
    const page = this.currentPage();

    this._clientService
      .getClients({
        status: this.statusFilter(),
        page,
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

  loadPendingRequests(): void {
    this._clientService.getPendingRequests().subscribe({
      next: (requests) => this.pendingRequests.set(requests),
      error: () => {},
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

  // Archive
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

  // Pending requests actions
  acceptPendingRequest(request: ClientRequest): void {
    this._clientService.acceptRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Request accepted',
          detail: 'Client request accepted successfully',
        });
        this.loadPendingRequests();
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

  declinePendingRequest(request: ClientRequest): void {
    this._clientService.declineRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: 'Request declined',
          detail: 'Client request has been declined',
        });
        this.loadPendingRequests();
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

  // Helpers
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

  initials(client: InstructorClient): string {
    if (!client.client) return '??';
    return client.client.firstName.charAt(0) + client.client.lastName.charAt(0);
  }

  clientName(client: InstructorClient): string {
    if (!client.client) return 'Unknown';
    return `${client.client.firstName} ${client.client.lastName}`;
  }

  requestFromName(request: ClientRequest): string {
    if (!request.fromUser) return 'Unknown';
    return `${request.fromUser.firstName} ${request.fromUser.lastName}`;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
