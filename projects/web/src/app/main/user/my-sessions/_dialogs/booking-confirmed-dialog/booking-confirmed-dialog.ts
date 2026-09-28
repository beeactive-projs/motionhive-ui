import {
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import {
  PublicSessionInstance,
  SessionParticipantStatus,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-booking-confirmed-dialog` — success modal shown after a booking lands.
 *
 * Replaces the previous fire-and-forget toast with a richer surface so the
 * user can add the session to their calendar (Apple .ics + Google + Outlook)
 * and acknowledge the cancellation window before they leave the page.
 */
@Component({
  selector: 'mh-booking-confirmed-dialog',
  imports: [DatePipe, Dialog, ButtonDirective, TranslatePipe],
  templateUrl: './booking-confirmed-dialog.html',
})
export class BookingConfirmedDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly instance = input<PublicSessionInstance | null>(null);
  /**
   * `BookResponse.status` from the server. Drives copy + which sections
   * render: PENDING_APPROVAL hides the calendar-export row (the session
   * isn't theirs yet); CONFIRMED / WAITLISTED show it.
   */
  readonly status = input<SessionParticipantStatus>(SessionParticipantStatus.Confirmed);
  readonly goMySessions = output<void>();

  protected readonly isPending = computed(
    () => this.status() === SessionParticipantStatus.PendingApproval,
  );

  protected readonly headerLabel = computed(() =>
    this._translateService.instant(
      this.isPending()
        ? 'mySessions.bookingConfirmed.headerPending'
        : 'mySessions.bookingConfirmed.headerConfirmed',
    ),
  );

  /** Calendar-event body: the description, then the meeting link if any. */
  private _eventDetails(description: string, meetingUrl: string | null | undefined): string {
    if (!meetingUrl) return description;
    const join = this._translateService.instant('mySessions.bookingConfirmed.calendarJoin', {
      url: meetingUrl,
    });
    return `${description}\n\n${join}`;
  }

  protected googleUrl(): string {
    const inst = this.instance();
    const tpl = inst?.template;
    if (!inst || !tpl) return '#';
    // Google's URL spec: YYYYMMDDTHHmmssZ for UTC.
    const fmt = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = encodeURIComponent(inst.titleOverride ?? tpl.title);
    const dates = `${fmt(inst.startAt)}/${fmt(inst.endAt)}`;
    const details = encodeURIComponent(
      this._eventDetails(inst.descriptionOverride ?? tpl.description ?? '', tpl.meetingUrl),
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  }

  protected outlookUrl(): string {
    const inst = this.instance();
    const tpl = inst?.template;
    if (!inst || !tpl) return '#';
    const subject = encodeURIComponent(inst.titleOverride ?? tpl.title);
    const body = encodeURIComponent(
      this._eventDetails(inst.descriptionOverride ?? tpl.description ?? '', tpl.meetingUrl),
    );
    return (
      'https://outlook.live.com/calendar/0/deeplink/compose' +
      `?subject=${subject}` +
      `&startdt=${encodeURIComponent(this.instance()!.startAt)}` +
      `&enddt=${encodeURIComponent(this.instance()!.endAt)}` +
      `&body=${body}` +
      '&path=/calendar/action/compose&rru=addevent'
    );
  }

  /** Open a calendar provider's "add event" page in a new tab. */
  protected openExternal(url: string): void {
    if (url && url !== '#') window.open(url, '_blank', 'noopener');
  }

  protected downloadIcs(): void {
    const inst = this.instance();
    if (!inst) return;
    this._sessionService.downloadIcs(inst.id).subscribe({
      error: (err: unknown) =>
        showApiError(
          this._messageService,
          this._translateService.instant('mySessions.toast.downloadFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        ),
    });
  }

  protected close(): void {
    this.visible.set(false);
  }

  protected goToMy(): void {
    this.visible.set(false);
    this.goMySessions.emit();
  }
}
