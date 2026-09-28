import {
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { clientDisplayName, ClientService, InstructorClient } from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { UserInfo } from '../../../../_shared/components/user-info/user-info';

@Component({
  selector: 'mh-edit-client-notes-dialog',
  imports: [FormsModule, ButtonDirective, Dialog, TextareaModule, UserInfo, TranslatePipe],
  templateUrl: './edit-client-notes-dialog.html',
  styleUrl: './edit-client-notes-dialog.scss',
})
export class EditClientNotesDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

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
    return clientDisplayName(client, this._translateService.instant('common.unknown'));
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
          summary: this._translateService.instant('clients.toast.notesSaved.summary'),
          detail: this._translateService.instant('clients.toast.notesSaved.detail'),
        });
        this.saved.emit();
      },
      error: () => {
        this.notesLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('clients.toast.notesSaveFailed'),
        });
      },
    });
  }
}
