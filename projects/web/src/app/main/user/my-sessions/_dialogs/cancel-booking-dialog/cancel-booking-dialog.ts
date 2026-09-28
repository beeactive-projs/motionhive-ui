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
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';
import {
  CancelBookingResponse,
  SessionParticipant,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-cancel-booking-dialog` — client cancels their own booking.
 *
 * Surfaces the snapshot cancel cutoff so the user knows whether they're
 * within the window. The BE returns `cancellation: 'WITHIN_WINDOW' |
 * 'OUTSIDE_WINDOW'` — we toast a different message in each case.
 */
@Component({
  selector: 'mh-cancel-booking-dialog',
  imports: [FormsModule, Dialog, ButtonDirective, Message, Textarea, InputText, TranslatePipe],
  templateUrl: './cancel-booking-dialog.html',
})
export class CancelBookingDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly participant = input<SessionParticipant | null>(null);
  readonly cancelled = output<CancelBookingResponse>();

  readonly reason = signal('');
  readonly message = signal('');
  readonly busy = signal(false);

  private readonly _reset = effect(() => {
    if (this.visible()) {
      this.reason.set('');
      this.message.set('');
    }
  });

  close(): void {
    this.visible.set(false);
  }

  submit(): void {
    const p = this.participant();
    if (!p?.instanceId) return;
    this.busy.set(true);
    this._sessionService
      .cancelBooking(p.instanceId, {
        reason: this.reason().trim() || undefined,
        message: this.message().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.visible.set(false);
          const detail = this._translateService.instant(
            res.cancellation === 'WITHIN_WINDOW'
              ? 'mySessions.toast.cancelled.withinWindow'
              : 'mySessions.toast.cancelled.outsideWindow',
          );
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('mySessions.toast.cancelled.summary'),
            detail,
          });
          this.cancelled.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('mySessions.toast.cancelFailed'),
            this._translateService.instant('common.pleaseTryAgain'),
            err,
          );
        },
      });
  }
}
