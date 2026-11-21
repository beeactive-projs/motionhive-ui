import { Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { PublicSessionInstance, SessionService } from 'core';

import { sessionCalendarEvent } from '../config/session-calendar.config';
import { FeedbackService } from './feedback.service';

/** The calendar plugin, as far as this service uses it (a fake in specs). */
export type CalendarPrompt = Pick<typeof CapacitorCalendar, 'createEventWithPrompt'>;

/**
 * "Add to calendar" on a session.
 *
 * On the phone it opens the system's own new-event screen, filled in with
 * the session (`@ebarooni/capacitor-calendar`): the person checks it and
 * saves, and the app never reads their calendar (iOS asks for add-only
 * access, Android needs no permission). The old way, downloading an .ics
 * file, did nothing inside the app. The web build still downloads it.
 */
@Service()
export class SessionCalendarService {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  /** Swapped in specs; the real plugin and platform otherwise. */
  native = Capacitor.isNativePlatform();
  calendar: CalendarPrompt = CapacitorCalendar;

  async add(instance: PublicSessionInstance): Promise<void> {
    if (!this.native) {
      this._download(instance.id);
      return;
    }
    const event = sessionCalendarEvent(
      instance,
      this._translateService.instant('pageTitle.session'),
    );
    try {
      const result = await this.calendar.createEventWithPrompt({
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location ?? undefined,
        url: event.url,
      });
      // iOS says when it was saved (Android never does, and its editor
      // closes on save, which is feedback enough).
      if (result.id) {
        await this._feedbackService.success(
          this._translateService.instant('mySessions.toast.calendarAdded'),
        );
      }
    } catch (error: unknown) {
      await this._feedbackService.error(
        error,
        this._translateService.instant('mySessions.toast.calendarOpenFailed'),
      );
    }
  }

  private _download(id: string): void {
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
}
