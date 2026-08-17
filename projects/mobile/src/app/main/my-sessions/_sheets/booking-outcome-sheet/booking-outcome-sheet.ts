import { Component, computed, input, model, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

export type BookingOutcome = 'CONFIRMED' | 'PENDING_APPROVAL' | 'WAITLISTED';

/**
 * Where a booking lands (3c / 3d / 3e).
 *
 * One tap has three possible results and the trainee cannot tell which until
 * the server answers, so the sheet does the telling. Each says what happened
 * and what happens next — the missing "next" is what turns into a message to
 * the coach asking whether it worked.
 *
 * The waitlist copy never states a position. `waitlistPosition` is always
 * null, arrival order is all there is, so "if a spot opens" is the only
 * honest promise available.
 */
@Component({
  selector: 'mh-booking-outcome-sheet',
  imports: [IonButton, IonIcon, SheetShell],
  templateUrl: './booking-outcome-sheet.html',
  styleUrl: './booking-outcome-sheet.scss',
})
export class BookingOutcomeSheet {
  readonly open = model(false);
  readonly outcome = input.required<BookingOutcome>();
  readonly sessionTitle = input('');
  readonly whenLabel = input('');
  readonly coachName = input('');

  readonly addToCalendar = output<void>();

  readonly copy = computed(() => {
    switch (this.outcome()) {
      case 'PENDING_APPROVAL':
        return {
          icon: 'time-outline',
          tone: 'warning',
          title: 'Request sent',
          body: `${this.coachName() || 'Your coach'} decides whether to approve this. We'll tell you either way — you do not need to chase it.`,
        };
      case 'WAITLISTED':
        return {
          icon: 'people-outline',
          tone: 'info',
          title: "You're on the waitlist",
          body: "The session is full. If a spot opens you'll be moved in automatically and notified — there is nothing else to do.",
        };
      default:
        return {
          icon: 'checkmark-circle-outline',
          tone: 'success',
          title: "You're booked in",
          body: 'See you there. Add it to your calendar so it does not get lost.',
        };
    }
  });

  /** Only a confirmed seat is worth putting in a calendar. */
  readonly showCalendar = computed(() => this.outcome() === 'CONFIRMED');
}
