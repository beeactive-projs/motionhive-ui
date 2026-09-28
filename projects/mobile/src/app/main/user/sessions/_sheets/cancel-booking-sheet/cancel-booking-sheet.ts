import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import {
  CancelBookingResponse,
  SessionParticipant,
  SessionService,
  formatSessionDayShort,
  formatSessionTime,
  isLateCancel,
} from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { ClockService } from '../../../../../_shared/services/clock.service';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import {
  bookingCoach,
  bookingTitle,
  cancelSheetVariant,
} from '../../my-sessions.config';

/**
 * Cancel a booking, leave the waitlist, or withdraw a pending request — one
 * sheet, the copy keyed to the booking's status.
 *
 * For a confirmed seat, two facts sit in two deliberately separate cards: the
 * terms card states what was agreed WHEN THEY BOOKED (the immutable snapshot
 * on the booking — never the coach's current terms), and the amber card
 * appears only when the cancel is late, saying where they stand now. It
 * informs; it never blocks — the confirm button works either way, and the
 * server's within/outside-window verdict decides the toast.
 */
@Component({
  selector: 'mh-cancel-booking-sheet',
  imports: [IonIcon, SheetShell, TranslatePipe],
  templateUrl: './cancel-booking-sheet.html',
  styleUrl: './cancel-booking-sheet.scss',
})
export class CancelBookingSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _clockService = inject(ClockService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly participant = input<SessionParticipant | null>(null);

  readonly cancelled = output<CancelBookingResponse>();

  readonly saving = signal(false);

  readonly variant = computed(() => cancelSheetVariant(this.participant()?.status));

  /** "Run club · Sat 23 May, 08:00" — which booking is on the block. */
  readonly subtitle = computed(() => {
    const participant = this.participant();
    const startAt = participant?.instance?.startAt;
    if (!participant || !startAt) return '';
    return `${bookingTitle(participant)} · ${formatSessionDayShort(startAt)}, ${formatSessionTime(startAt)}`;
  });

  readonly termsTitle = computed(() => {
    const cutoff = this.participant()?.snapshotCancelCutoffH ?? 0;
    return cutoff > 0
      ? this._translateService.instant('mySessions.cancelSheet.terms.cutoff', { hours: cutoff })
      : this._translateService.instant('mySessions.cancelSheet.terms.anyTime');
  });

  readonly agreedLine = computed(() => {
    const bookedAt = this.participant()?.bookedAt;
    return bookedAt
      ? this._translateService.instant('mySessions.cancelSheet.agreed', {
          date: formatSessionDayShort(bookedAt),
        })
      : '';
  });

  readonly isLate = computed(() => {
    const participant = this.participant();
    const startAt = participant?.instance?.startAt;
    if (!this.variant().showTerms || !participant || !startAt) return false;
    return isLateCancel(
      startAt,
      participant.snapshotCancelCutoffH,
      this._clockService.now(),
    );
  });

  /** "It's 6 h before start — this is a late cancel". */
  readonly lateTitle = computed(() => {
    const startAt = this.participant()?.instance?.startAt;
    if (!startAt) return '';
    const msUntil = new Date(startAt).getTime() - this._clockService.now();
    if (msUntil <= 0) {
      return this._translateService.instant('mySessions.cancelSheet.late.started');
    }
    const minutes = Math.round(msUntil / 60_000);
    return minutes < 60
      ? this._translateService.instant('mySessions.cancelSheet.late.minutesBefore', {
          count: minutes,
        })
      : this._translateService.instant('mySessions.cancelSheet.late.hoursBefore', {
          count: Math.floor(minutes / 60),
        });
  });

  readonly lateDetail = computed(() => {
    const participant = this.participant();
    const first = participant ? bookingCoach(participant)?.firstName?.trim() : '';
    return first
      ? this._translateService.instant('mySessions.cancelSheet.late.detail', { name: first })
      : this._translateService.instant('mySessions.cancelSheet.late.detailNoCoach');
  });

  confirm(): void {
    const participant = this.participant();
    if (!participant || this.saving()) return;
    this.saving.set(true);

    this._sessionService
      .cancelBooking(participant.instanceId)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          // The server's verdict, not our clock, decides what we promise.
          const toast =
            this.variant().successToast ??
            this._translateService.instant(
              result.cancellation === 'WITHIN_WINDOW'
                ? 'mySessions.toast.cancelledWithin'
                : 'mySessions.toast.cancelledOutside',
            );
          void this._feedbackService.success(toast);
          this.cancelled.emit(result);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('mySessions.toast.cancelFailed'),
          );
        },
      });
  }
}
