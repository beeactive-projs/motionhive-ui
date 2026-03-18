import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { InstructorClient, InstructorClientStatus, ClientRequest, ClientService } from 'core';

type TagSeverity =
  | 'success'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'info'
  | 'contrast'
  | null
  | undefined;

@Component({
  selector: 'bee-clients',
  imports: [
    DatePipe,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
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

  // Invite dialog
  showInviteDialog = signal(false);
  inviteEmail = '';
  inviteMessage = '';
  inviteLoading = signal(false);

  // Notes dialog
  showNotesDialog = signal(false);
  editingClient = signal<InstructorClient | null>(null);
  editNotes = '';
  notesLoading = signal(false);

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

  // Invite
  openInviteDialog(): void {
    this.inviteEmail = '';
    this.inviteMessage = '';
    this.showInviteDialog.set(true);
  }

  sendInvitation(): void {
    if (!this.inviteEmail.trim()) return;

    this.inviteLoading.set(true);
    this._clientService
      .sendInvitation({
        email: this.inviteEmail.trim(),
        message: this.inviteMessage.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.inviteLoading.set(false);
          this.showInviteDialog.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Invitation Sent',
            detail: 'Client invitation has been sent successfully',
          });
          this.loadClients();
        },
        error: (err) => {
          this.inviteLoading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to send invitation',
          });
        },
      });
  }

  // Notes
  openNotesDialog(client: InstructorClient): void {
    this.editingClient.set(client);
    this.editNotes = client.notes || '';
    this.showNotesDialog.set(true);
  }

  saveNotes(): void {
    const client = this.editingClient();
    if (!client) return;

    this.notesLoading.set(true);
    this._clientService.updateClient(client.clientId, { notes: this.editNotes }).subscribe({
      next: () => {
        this.notesLoading.set(false);
        this.showNotesDialog.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Notes Saved',
          detail: 'Client notes updated successfully',
        });
        this.loadClients();
      },
      error: () => {
        this.notesLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save notes',
        });
      },
    });
  }

  // Archive
  confirmArchive(client: InstructorClient): void {
    const name = client.client
      ? `${client.client.firstName} ${client.client.lastName}`
      : 'this client';
    this._confirmationService.confirm({
      message: `Are you sure you want to archive ${name}?`,
      header: 'Archive Client',
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
          summary: 'Client Archived',
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
          summary: 'Request Accepted',
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
          summary: 'Request Declined',
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
        return 'success';
      case 'ARCHIVED':
        return 'danger';
      case 'PENDING':
        return 'warn';
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
