import { Component, computed, inject, input, model, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonNote } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import {
  PublicSessionInstance,
  SessionLocationKind,
  SessionParticipantStatus,
  SessionService,
  formatSessionTime,
  sessionMinutes,
} from 'core';

import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';

/**
 * What the booking POST came back with — one sheet, three landings keyed to
 * `BookResponse.status`: confirmed, awaiting approval, or waitlisted.
 *
 * Each landing sets the only honest expectation it can. Approval names the
 * coach who decides and promises a notification either way — the line that
 * stops "did it work?" messages. The waitlist promises auto-promotion and
 * NEVER a queue position (the backend column is always null; arrival order
 * is all that exists, so it is "if a spot opens", not "you're next").
 */
@Component({
  selector: 'mh-booking-outcome-sheet',
  imports: [HexAvatar, IonBadge, IonButton, IonIcon, IonNote, SheetShell],
  templateUrl: './booking-outcome-sheet.html',
  styleUrl: './booking-outcome-sheet.scss',
})
export class BookingOutcomeSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  readonly status = input<SessionParticipantStatus | null>(null);
  readonly instance = input<PublicSessionInstance | null>(null);

  readonly done = output<void>();

  readonly Statuses = SessionParticipantStatus;

  readonly heading = computed(() => {
    switch (this.status()) {
      case SessionParticipantStatus.PendingApproval:
        return 'Request sent';
      case SessionParticipantStatus.Waitlisted:
        return "You're on the waitlist";
      default:
        return "You're booked";
    }
  });

  readonly copy = computed(() => {
    switch (this.status()) {
      case SessionParticipantStatus.PendingApproval: {
        const first = this._coachFirstName();
        return first
          ? `${first} approves bookings for this session. You'll get a notification either way — nothing else to do.`
          : "The coach approves bookings for this session. You'll get a notification either way — nothing else to do.";
      }
      case SessionParticipantStatus.Waitlisted:
        return "This session is full. If a spot opens you're booked automatically — we'll notify you.";
      default:
        return 'Your spot in this session is confirmed.';
    }
  });

  readonly tile = computed(() => {
    switch (this.status()) {
      case SessionParticipantStatus.PendingApproval:
        return { icon: 'hourglass-outline', color: 'warning' };
      case SessionParticipantStatus.Waitlisted:
        return { icon: 'people-outline', color: 'info' };
      default:
        return { icon: 'checkmark-outline', color: 'success' };
    }
  });

  readonly isConfirmed = computed(
    () => this.status() === SessionParticipantStatus.Confirmed,
  );

  readonly isPending = computed(
    () => this.status() === SessionParticipantStatus.PendingApproval,
  );

  readonly isWaitlisted = computed(
    () => this.status() === SessionParticipantStatus.Waitlisted,
  );

  /** "Sat" over "23" — the summary card's date tile. */
  readonly dateTile = computed(() => {
    const startAt = this.instance()?.startAt;
    if (!startAt) return null;
    const date = new Date(startAt);
    return {
      weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      day: date.getDate(),
    };
  });

  readonly title = computed(
    () =>
      this.instance()?.titleOverride ?? this.instance()?.template?.title ?? 'Session',
  );

  /** "08:00 · 90 min · Herăstrău loop" */
  readonly summaryLine = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const minutes = sessionMinutes(instance);
    const place =
      instance.template?.locationKind === SessionLocationKind.Online
        ? 'Online'
        : (instance.venueOverride?.name ?? instance.template?.venue?.name ?? '');
    return [formatSessionTime(instance.startAt), minutes ? `${minutes} min` : '', place]
      .filter(Boolean)
      .join(' · ');
  });

  addToCalendar(): void {
    const id = this.instance()?.id;
    if (!id) return;
    this._sessionService
      .downloadIcs(id)
      .pipe(take(1))
      .subscribe({
        next: () => void this._feedbackService.success('Calendar file downloaded'),
        error: (error: unknown) =>
          void this._feedbackService.error(error, "Couldn't download the invite."),
      });
  }

  dismiss(): void {
    this.open.set(false);
    this.done.emit();
  }

  private _coachFirstName(): string {
    const instance = this.instance();
    return (
      instance?.instructor?.firstName ??
      instance?.template?.instructor?.firstName ??
      ''
    ).trim();
  }
}
