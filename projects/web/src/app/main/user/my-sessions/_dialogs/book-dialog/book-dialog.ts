import {
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import {
  BookResponse,
  PublicSessionInstance,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-book-dialog` — confirms a booking for a public session instance.
 *
 * Shows the snapshot terms (price, cancel cutoff) so the user
 * acknowledges what they're committing to. Optional `bookingNote`
 * surfaces a text field for instructors who require approval.
 */
@Component({
  selector: 'mh-book-dialog',
  imports: [DatePipe, DecimalPipe, FormsModule, Dialog, ButtonDirective, Textarea, TranslatePipe],
  templateUrl: './book-dialog.html',
})
export class BookDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly instance = input<PublicSessionInstance | null>(null);
  readonly booked = output<BookResponse>();

  readonly note = signal('');
  readonly busy = signal(false);

  private readonly _reset = effect(() => {
    if (this.visible()) this.note.set('');
  });

  protected confirmLabel(): string {
    const tpl = this.instance()?.template;
    if (!tpl) return this._translateService.instant('mySessions.book.confirm');
    return this._translateService.instant(
      tpl.approvalRequired ? 'button.requestToJoin' : 'mySessions.book.confirmBooking',
    );
  }

  close(): void {
    this.visible.set(false);
  }

  submit(): void {
    const inst = this.instance();
    if (!inst) return;
    this.busy.set(true);
    this._sessionService
      .book(inst.id, { bookingNote: this.note().trim() || undefined })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.visible.set(false);
          this.booked.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          // BE returns 409 Conflict when the user already has a booking
          // that overlaps this instance. Surface that with a clearer
          // wording than "Could not book — Conflict".
          const status = (err as { status?: number })?.status;
          if (status === 409) {
            this._messageService.add({
              severity: 'warn',
              summary: this._translateService.instant('mySessions.toast.bookConflict.summary'),
              detail: this._translateService.instant('mySessions.toast.bookConflict.detail'),
              life: 6000,
            });
            return;
          }
          showApiError(
            this._messageService,
            this._translateService.instant('mySessions.toast.bookFailed'),
            this._translateService.instant('common.pleaseTryAgain'),
            err,
          );
        },
      });
  }
}
