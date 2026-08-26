import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { SessionParticipant, formatSessionDuration, formatSessionTime } from 'core';

import { ClockService } from '../../../../../_shared/services/clock.service';
import {
  bookingChip,
  bookingDurationMinutes,
  bookingMeta,
  bookingTitle,
  bookingTone,
  isOnlineBooking,
  showJoinPill,
} from '../../my-sessions.config';

/**
 * One booking row: the coach agenda row's geometry — time rail, title, meta,
 * chevron — with the spine re-keyed from session type to the trainee's
 * BOOKING status: emerald booked, honey awaiting approval, sky waitlisted,
 * slate once it is a record. "Do I have a seat" is this list's question.
 *
 * A live online booking swaps the chevron for the honey Join pill — the one
 * action on this screen worth painting with the brand's action colour.
 */
@Component({
  selector: 'mh-my-session-row',
  imports: [IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './my-session-row.html',
  styleUrl: './my-session-row.scss',
})
export class MySessionRow {
  private readonly _clockService = inject(ClockService);

  readonly booking = input.required<SessionParticipant>();

  readonly select = output<void>();
  /** The Join pill — the page resolves the link and opens it. */
  readonly join = output<void>();

  readonly title = computed(() => bookingTitle(this.booking()));

  readonly time = computed(() => {
    const startAt = this.booking().instance?.startAt;
    return startAt ? formatSessionTime(startAt) : '';
  });

  readonly duration = computed(() => {
    const minutes = bookingDurationMinutes(this.booking());
    return minutes ? formatSessionDuration(minutes) : '';
  });

  /** Drives the spine colour via a `data-tone` attribute. */
  readonly tone = computed(() =>
    bookingTone(this.booking(), this._clockService.now()),
  );

  readonly chip = computed(() =>
    bookingChip(this.booking(), this._clockService.now()),
  );

  readonly meta = computed(() => bookingMeta(this.booking()));

  readonly isOnline = computed(() => isOnlineBooking(this.booking()));

  readonly showJoin = computed(() =>
    showJoinPill(this.booking(), this._clockService.now()),
  );

  onJoin(event: Event): void {
    // The pill sits inside the row button; joining must not also navigate.
    event.stopPropagation();
    this.join.emit();
  }
}
