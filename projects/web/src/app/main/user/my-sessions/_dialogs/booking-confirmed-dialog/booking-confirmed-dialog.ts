import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Button } from 'primeng/button';
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
  imports: [DatePipe, Dialog, Button],
  templateUrl: './booking-confirmed-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingConfirmedDialog {
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly instance = input<PublicSessionInstance | null>(null);
  /**
   * `BookResponse.status` from the server. Drives copy + which sections
   * render: PENDING_APPROVAL hides the calendar-export row (the session
   * isn't theirs yet); CONFIRMED / WAITLISTED show it.
   */
  readonly status = input<SessionParticipantStatus>('CONFIRMED');
  readonly goMySessions = output<void>();

  protected readonly isPending = computed(
    () => this.status() === 'PENDING_APPROVAL',
  );

  protected readonly headerLabel = computed(() =>
    this.isPending() ? 'Request sent!' : "You're in!",
  );

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
      (inst.descriptionOverride ?? tpl.description ?? '') +
        (tpl.meetingUrl ? `\n\nJoin: ${tpl.meetingUrl}` : ''),
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  }

  protected outlookUrl(): string {
    const inst = this.instance();
    const tpl = inst?.template;
    if (!inst || !tpl) return '#';
    const subject = encodeURIComponent(inst.titleOverride ?? tpl.title);
    const body = encodeURIComponent(
      (inst.descriptionOverride ?? tpl.description ?? '') +
        (tpl.meetingUrl ? `\n\nJoin: ${tpl.meetingUrl}` : ''),
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
          'Could not download calendar file',
          'Please try again.',
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
