import { Component, input, model, output } from '@angular/core';
import { IonNote } from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

/**
 * Confirming a cancellation, with the two facts kept apart (3i).
 *
 * The terms card says what was agreed *when they booked* — the cutoff is
 * captured on the booking, so a coach who later changed it does not change
 * this. The warning card says where they stand *now*, and only appears once
 * the free window has passed. Merging them into one paragraph made it read
 * like a penalty notice even when there was nothing to pay.
 */
@Component({
  selector: 'mh-cancel-booking-sheet',
  imports: [IonNote, SheetShell],
  templateUrl: './cancel-booking-sheet.html',
  styleUrl: './cancel-booking-sheet.scss',
})
export class CancelBookingSheet {
  readonly open = model(false);
  /** Null when the session has no cancellation window at all. */
  readonly cancelBy = input<string | null>(null);
  readonly isLate = input(false);
  readonly isWaitlist = input(false);
  readonly saving = input(false);

  readonly confirm = output<void>();
}
