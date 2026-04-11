import {
  Component,
  ChangeDetectionStrategy,
  inject,
  model,
  output,
  input,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { InstructorClient, ClientService } from 'core';

@Component({
  selector: 'mh-edit-client-notes-dialog',
  imports: [FormsModule, Avatar, Button, Dialog, TextareaModule],
  templateUrl: './edit-client-notes-dialog.html',
  styleUrl: './edit-client-notes-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditClientNotesDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly client = input<InstructorClient | null>(null);
  readonly saved = output<void>();

  editNotes = '';
  readonly notesLoading = signal(false);

  private readonly _syncNotesEffect = effect(() => {
    this.editNotes = this.client()?.notes || '';
  });

  initials(client: InstructorClient): string {
    if (!client.client) return '??';
    return client.client.firstName.charAt(0) + client.client.lastName.charAt(0);
  }

  clientName(client: InstructorClient): string {
    if (!client.client) return 'Unknown';
    return `${client.client.firstName} ${client.client.lastName}`;
  }

  saveNotes(): void {
    const client = this.client();
    if (!client) return;

    this.notesLoading.set(true);
    this._clientService.updateClient(client.clientId, { notes: this.editNotes }).subscribe({
      next: () => {
        this.notesLoading.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Notes saved',
          detail: 'Client notes updated successfully',
        });
        this.saved.emit();
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
}
