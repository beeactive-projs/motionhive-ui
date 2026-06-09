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
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [closable]="true"
      [showHeader]="false"
      [style]="{ width: '28rem', maxWidth: '95vw' }"
    >
      @let inst = instance();
      @let tpl = inst?.template;
      @if (inst && tpl) {
        <div class="mh-bc">
          <div class="mh-bc__hero">
            <div class="mh-bc__check" aria-hidden="true">
              <i class="pi pi-check"></i>
            </div>
            <h2 class="mh-bc__title">
              @if (isPending()) { Request sent! }
              @else { You're in! }
            </h2>
            <p class="mh-bc__sub">
              @if (isPending()) {
                {{ tpl.title }} — {{ inst.startAt | date: 'EEE d MMM, HH:mm' }}.
                The instructor will review your request.
              } @else {
                {{ tpl.title }} on {{ inst.startAt | date: 'EEE d MMM' }}
                at {{ inst.startAt | date: 'HH:mm' }}.
              }
            </p>
          </div>

          @if (!isPending()) {
            <section class="mh-bc__section">
              <span class="mh-bc__label">Add to calendar</span>
              <div class="mh-bc__cal-buttons">
                <button
                  type="button"
                  class="mh-bc__cal-btn"
                  (click)="downloadIcs()"
                >
                  <i class="pi pi-apple" aria-hidden="true"></i>
                  Apple / .ics
                </button>
                <a
                  class="mh-bc__cal-btn"
                  [href]="googleUrl()"
                  target="_blank"
                  rel="noopener"
                >
                  <i class="pi pi-google" aria-hidden="true"></i>
                  Google
                </a>
                <a
                  class="mh-bc__cal-btn"
                  [href]="outlookUrl()"
                  target="_blank"
                  rel="noopener"
                >
                  <i class="pi pi-microsoft" aria-hidden="true"></i>
                  Outlook
                </a>
              </div>
            </section>
          }

          <section class="mh-bc__section">
            <span class="mh-bc__label">What happens next</span>
            <ul class="mh-bc__steps">
              <li>
                <i class="pi pi-envelope" aria-hidden="true"></i>
                <span>
                  @if (isPending()) {
                    You'll get an email when the instructor approves.
                  } @else {
                    Confirmation is on its way to your inbox.
                  }
                </span>
              </li>
              <li>
                <i class="pi pi-clock" aria-hidden="true"></i>
                <span>
                  Free to cancel until
                  {{ tpl.cancellationCutoffHours }}h before the start.
                </span>
              </li>
              @if (!isPending()) {
                <li>
                  <i class="pi pi-bell" aria-hidden="true"></i>
                  <span>We'll send you a reminder 24h and 1h before.</span>
                </li>
              }
            </ul>
          </section>
        </div>

        <ng-template #footer>
          <p-button
            label="Done"
            severity="secondary"
            [text]="true"
            (onClick)="close()"
          />
          <p-button
            label="Go to My sessions"
            icon="pi pi-arrow-right"
            iconPos="right"
            (onClick)="goToMy()"
          />
        </ng-template>
      }
    </p-dialog>
  `,
  styles: `
    .mh-bc { display: flex; flex-direction: column; gap: 18px; padding: 8px 0 0; }
    .mh-bc__hero {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 8px;
    }
    .mh-bc__check {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--p-green-100); color: var(--p-green-700);
      display: inline-flex; align-items: center; justify-content: center;
      i { font-size: 26px; font-weight: 700; }
    }
    .mh-bc__title {
      margin: 0; font-size: 20px; font-weight: 700;
      color: var(--p-text-color);
    }
    .mh-bc__sub {
      margin: 0; font-size: 14px; line-height: 1.4;
      color: var(--p-text-muted-color);
    }
    .mh-bc__section { display: flex; flex-direction: column; gap: 8px; }
    .mh-bc__label {
      font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
      text-transform: uppercase; color: var(--p-text-muted-color);
    }
    .mh-bc__cal-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .mh-bc__cal-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 8px; font-size: 12px; font-weight: 600;
      text-decoration: none;
      background: var(--p-content-background);
      color: var(--p-text-color);
      border: 1px solid var(--p-content-border-color);
      border-radius: 8px; cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
      i { font-size: 14px; color: var(--p-text-muted-color); }
      &:hover {
        border-color: var(--p-primary-300);
        background: var(--p-primary-50);
        i { color: var(--p-primary-700); }
      }
    }
    .mh-bc__steps {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 10px;
      li {
        display: flex; align-items: flex-start; gap: 10px;
        font-size: 13px; line-height: 1.45;
        color: var(--p-text-color);
        i {
          flex-shrink: 0;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--p-primary-50);
          color: var(--p-primary-700);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px;
        }
      }
    }
  `,
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
