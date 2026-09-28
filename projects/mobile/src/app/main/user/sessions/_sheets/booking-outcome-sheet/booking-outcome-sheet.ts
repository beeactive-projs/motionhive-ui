import { Component, computed, inject, input, model, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import {
  PublicSessionInstance,
  SESSION_LOCATION_KINDS,
  SessionLocationKind,
  SessionParticipantStatus,
  SessionService,
  appLocale,
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
  imports: [HexAvatar, IonBadge, IonButton, IonIcon, IonNote, SheetShell, TranslatePipe],
  templateUrl: './booking-outcome-sheet.html',
  styleUrl: './booking-outcome-sheet.scss',
})
export class BookingOutcomeSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly status = input<SessionParticipantStatus | null>(null);
  readonly instance = input<PublicSessionInstance | null>(null);

  readonly done = output<void>();

  readonly Statuses = SessionParticipantStatus;

  readonly heading = computed(() => {
    switch (this.status()) {
      case SessionParticipantStatus.PendingApproval:
        return this._translateService.instant('mySessions.outcome.pending.title');
      case SessionParticipantStatus.Waitlisted:
        return this._translateService.instant('mySessions.outcome.waitlisted.title');
      default:
        return this._translateService.instant('mySessions.outcome.confirmed.title');
    }
  });

  readonly copy = computed(() => {
    switch (this.status()) {
      case SessionParticipantStatus.PendingApproval: {
        const first = this._coachFirstName();
        return first
          ? this._translateService.instant('mySessions.outcome.pending.copy', { name: first })
          : this._translateService.instant('mySessions.outcome.pending.copyNoCoach');
      }
      case SessionParticipantStatus.Waitlisted:
        return this._translateService.instant('mySessions.outcome.waitlisted.copy');
      default:
        return this._translateService.instant('mySessions.outcome.confirmed.copy');
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
      weekday: date.toLocaleDateString(appLocale(), { weekday: 'short' }),
      day: date.getDate(),
    };
  });

  readonly title = computed(
    () =>
      this.instance()?.titleOverride ??
      this.instance()?.template?.title ??
      this._translateService.instant('common.session'),
  );

  /** "08:00 · 90 min · Herăstrău loop" */
  readonly summaryLine = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const minutes = sessionMinutes(instance);
    const place =
      instance.template?.locationKind === SessionLocationKind.Online
        ? SESSION_LOCATION_KINDS[SessionLocationKind.Online].label
        : (instance.venueOverride?.name ?? instance.template?.venue?.name ?? '');
    const duration = minutes
      ? this._translateService.instant('time.minutesShort', { minutes })
      : '';
    return [formatSessionTime(instance.startAt), duration, place]
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
        next: () =>
          void this._feedbackService.success(
            this._translateService.instant('mySessions.toast.calendarDownloaded'),
          ),
        error: (error: unknown) =>
          void this._feedbackService.error(
            error,
            this._translateService.instant('mySessions.toast.calendarFailed'),
          ),
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
