import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
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
  imports: [FormsModule, Dialog, Button, Message, Textarea, InputText],
  templateUrl: './cancel-booking-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelBookingDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);

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
          const summary =
            res.cancellation === 'WITHIN_WINDOW'
              ? 'Booking cancelled — no charge.'
              : 'Booking cancelled (outside cancel window — charges may still apply).';
          this._messageService.add({
            severity: 'success',
            summary: 'Cancelled',
            detail: summary,
          });
          this.cancelled.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          showApiError(
            this._messageService,
            'Could not cancel',
            'Please try again.',
            err,
          );
        },
      });
  }
}
