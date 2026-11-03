import { Component, effect, input, model, output, signal } from '@angular/core';
import { IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { REQUEST_EXPIRY_DAYS, REQUEST_MESSAGE_MAX_LENGTH } from '../../person.config';

/**
 * Asking a coach to coach you: who it goes to, a note for them, and Send.
 *
 * The note is open from the start, unlike an email invitation's: a coach
 * deciding on a stranger reads it first (it heads their request sheet and
 * their email), so it is the point of the sheet rather than an extra. It
 * stays optional.
 *
 * Purely presentational. The page owns the request, the toast and closing
 * the sheet, as the invitation sheets on the coach's side do.
 */
@Component({
  selector: 'mh-request-coach-sheet',
  imports: [IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './request-coach-sheet.html',
  styleUrl: './request-coach-sheet.scss',
})
export class RequestCoachSheet {
  readonly open = model(false);
  /** The coach, as the profile names them. */
  readonly name = input.required<string>();
  readonly saving = input(false);

  readonly send = output<string>();

  readonly expiryDays = REQUEST_EXPIRY_DAYS;
  readonly messageMaxLength = REQUEST_MESSAGE_MAX_LENGTH;

  readonly note = signal('');

  constructor() {
    // Seeded on open, so a note typed and dismissed is not carried into the
    // next coach.
    effect(() => {
      if (this.open()) this.note.set('');
    });
  }

  onSend(): void {
    this.send.emit(this.note().trim());
  }
}
