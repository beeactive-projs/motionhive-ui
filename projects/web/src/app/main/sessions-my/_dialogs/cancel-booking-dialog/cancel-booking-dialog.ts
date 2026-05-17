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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
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
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    ButtonModule,
    TextareaModule,
    InputText,
  ],
  template: `
    <p-dialog
      header="Cancel booking"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '28rem', maxWidth: '95vw' }"
      [closable]="true"
    >
      @let p = participant();
      <div class="mh-cb">
        @if (p) {
          <p class="mh-cb__intro">
            Cancel up to <strong>{{ p.snapshotCancelCutoffH }}h</strong> before
            the session to avoid charges.
          </p>
          <div class="mh-cb__field">
            <label for="cbReason">Reason (optional)</label>
            <input
              id="cbReason"
              pInputText
              fluid
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
              placeholder="Conflict, illness, etc."
            />
          </div>
          <div class="mh-cb__field">
            <label for="cbMessage">Message to instructor (optional)</label>
            <textarea
              id="cbMessage"
              pTextarea
              rows="3"
              fluid
              [ngModel]="message()"
              (ngModelChange)="message.set($event)"
              placeholder="Anything you want them to know."
            ></textarea>
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <p-button
          label="Keep booking"
          severity="secondary"
          [text]="true"
          (onClick)="close()"
        />
        <p-button
          label="Cancel booking"
          icon="pi pi-times"
          severity="danger"
          [loading]="busy()"
          (onClick)="submit()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .mh-cb { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
    .mh-cb__intro {
      margin: 0; padding: 10px 12px;
      background: color-mix(in srgb, var(--p-yellow-500) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-yellow-500) 25%, transparent);
      border-radius: 8px;
      font-size: 13px; color: var(--p-text-color);
      strong { color: var(--p-text-color); }
    }
    .mh-cb__field { display: flex; flex-direction: column; gap: 4px; }
    .mh-cb__field label {
      font-size: 12px; font-weight: 600; color: var(--p-text-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelBookingDialog {
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);

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
    this._svc
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
          this._msg.add({
            severity: 'success',
            summary: 'Cancelled',
            detail: summary,
          });
          this.cancelled.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          showApiError(this._msg, 'Could not cancel', 'Please try again.', err);
        },
      });
  }
}
