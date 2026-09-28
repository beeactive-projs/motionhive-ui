import {
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ClientService, showApiError } from 'core';
import { ButtonDirective } from 'primeng/button';
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
  imports: [FormsModule, Dialog, ButtonDirective, TextareaModule, TranslatePipe],
  providers: [MessageService],
  templateUrl: './request-to-be-client-dialog.html',
})
export class RequestToBeClientDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model<boolean>(false);
  readonly instructorUserId = input.required<string>();
  /** Coach's display name. When absent the copy falls back to "this coach". */
  readonly instructorName = input<string>();

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
          const name = this.instructorName();
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant(
              'toast.summary.requestSent',
            ),
            detail: name
              ? this._translateService.instant(
                  'components.requestToBeClientDialog.toast.sent.detail',
                  { name },
                )
              : this._translateService.instant(
                  'components.requestToBeClientDialog.toast.sent.detailNoName',
                ),
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('components.requestToBeClientDialog.toast.sendFailed'),
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
