import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientService, showApiError } from 'core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';

/**
 * Small reusable dialog that asks the current user for an optional
 * message and submits a "request to be client" against an instructor.
 *
 * Decoupled from any one feature: any surface that wants to wire a
 * "Message instructor" CTA mounts this dialog and binds
 * `[(visible)]` + `[instructorUserId]`. Toast feedback is owned by
 * the dialog so consumers don't need their own MessageService.
 */
@Component({
  selector: 'mh-request-to-be-client-dialog',
  imports: [FormsModule, Dialog, Button, TextareaModule],
  providers: [MessageService],
  templateUrl: './request-to-be-client-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestToBeClientDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly instructorUserId = input.required<string>();
  readonly instructorName = input<string>('this instructor');

  readonly message = signal('');
  readonly submitting = signal(false);

  send(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this._clientService
      .requestToBeClient(this.instructorUserId(), this.message() || undefined)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.visible.set(false);
          this.message.set('');
          this._messageService.add({
            severity: 'success',
            summary: 'Request sent',
            detail: `Your request to join ${this.instructorName()} was sent.`,
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          showApiError(
            this._messageService,
            'Error',
            'Failed to send request',
            err,
          );
        },
      });
  }

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
    this.message.set('');
  }
}
