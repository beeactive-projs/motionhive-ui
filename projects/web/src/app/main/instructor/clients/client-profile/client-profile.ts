import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ClientService,
  ClientStatusLabels,
  InitiatedByOptions,
  InstructorClient,
  InstructorClientStatuses,
  TagSeverity,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { EditClientNotesDialog } from '../../_dialogs/edit-client-notes-dialog/edit-client-notes-dialog';

@Component({
  selector: 'mh-client-profile',
  imports: [DatePipe, Avatar, Button, Card, Tag, Toast, ConfirmDialog, EditClientNotesDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientProfile {
  private readonly _router = inject(Router);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly Statuses = InstructorClientStatuses;
  readonly InitiatedBy = InitiatedByOptions;

  readonly client = signal<InstructorClient | null>(null);
  readonly activeTab = signal(0);
  readonly showNotesDialog = signal(false);

  readonly tabs = [
    { label: 'Overview', value: 0, icon: 'pi pi-home' },
    { label: 'Sessions', value: 1, icon: 'pi pi-calendar' },
    { label: 'Progress', value: 2, icon: 'pi pi-chart-line' },
  ];

  readonly clientName = computed(() => {
    const c = this.client();
    if (!c) return '';
    if (c.client) return `${c.client.firstName} ${c.client.lastName}`;
    return c.invitedEmail ?? 'Unknown';
  });

  readonly clientEmail = computed(() => {
    const c = this.client();
    return c?.client?.email ?? c?.invitedEmail ?? '—';
  });

  readonly initials = computed(() => {
    const c = this.client();
    if (!c) return '?';
    if (c.client) return c.client.firstName.charAt(0) + c.client.lastName.charAt(0);
    return c.invitedEmail?.charAt(0).toUpperCase() ?? '?';
  });

  readonly statusLabel = computed(() => {
    const c = this.client();
    if (!c) return '';
    return ClientStatusLabels[c.status];
  });

  readonly statusSeverity = computed((): TagSeverity => {
    switch (this.client()?.status) {
      case 'ACTIVE':
        return TagSeverity.Success;
      case 'ARCHIVED':
        return TagSeverity.Danger;
      case 'PENDING':
        return TagSeverity.Warn;
      default:
        return TagSeverity.Secondary;
    }
  });

  constructor() {
    const nav = this._router.getCurrentNavigation();
    const state = nav?.extras?.state as { client?: InstructorClient } | undefined;
    if (state?.client) {
      this.client.set(state.client);
    } else {
      const histState = window.history.state as { client?: InstructorClient };
      if (histState?.client) {
        this.client.set(histState.client);
      }
    }
  }

  goBack(): void {
    this._router.navigate(['/coaching/clients']);
  }

  openNotesDialog(): void {
    this.showNotesDialog.set(true);
  }

  onNotesSaved(): void {
    // Refresh from server once the individual-client endpoint is available
  }

  confirmArchive(): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to archive ${this.clientName()}?`,
      header: 'Archive client',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doArchive(),
    });
  }

  private doArchive(): void {
    const c = this.client();
    if (!c) return;
    this._clientService.archiveClient(c.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client archived',
          detail: 'Client relationship has been archived',
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Archived } : prev,
        );
      },
      error: (err) => showApiError(this._messageService, 'Archive failed', 'Failed to archive client', err),
    });
  }

  confirmUnarchive(): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to unarchive ${this.clientName()}?`,
      header: 'Unarchive client',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.doUnarchive(),
    });
  }

  private doUnarchive(): void {
    const c = this.client();
    if (!c) return;
    this._clientService.unarchiveClient(c.clientId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Client unarchived',
          detail: 'Client relationship has been restored',
        });
        this.client.update((prev) =>
          prev ? { ...prev, status: InstructorClientStatuses.Active } : prev,
        );
      },
      error: (err) =>
        showApiError(this._messageService, 'Unarchive failed', 'Failed to unarchive client', err),
    });
  }
}
