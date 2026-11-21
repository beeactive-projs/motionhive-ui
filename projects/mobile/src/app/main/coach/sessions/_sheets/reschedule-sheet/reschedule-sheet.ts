import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IonButton, IonDatetime, IonModal } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import {
  RescheduleInstanceResponse,
  SessionInstance,
  SessionService,
  formatSessionDayShort,
  formatSessionTime,
} from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { DatetimeLocaleDirective } from '../../../../../_shared/directives/datetime-locale.directive';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import { deviceTimezone, wallClockInZone, zonedWallClockToIso } from '../../sessions.config';

/** "Thu 21 May · 09:00", for a wall clock as `ion-datetime` binds it. */
function wallClockLabel(wallClock: string): string {
  return `${formatSessionDayShort(wallClock)} · ${formatSessionTime(wallClock)}`;
}

/**
 * Move one date to another time, keeping its bookings.
 *
 * `POST /sessions/instances/:id/reschedule`: this occurrence only, the same
 * length, and everyone still booked (confirmed, waiting on approval or on the
 * waitlist) is told the new time by the API. The rest of a series stays.
 *
 * The time is picked on the session's own clock, the template's zone, as the
 * create form picks it (`zonedWallClockToIso`), with now as the floor.
 *
 * No message field: the endpoint accepts `message` but never puts it in the
 * notice, so a note typed here would reach nobody.
 */
@Component({
  selector: 'mh-reschedule-sheet',
  imports: [DatetimeLocaleDirective, IonButton, IonDatetime, IonModal, SheetShell, TranslatePipe],
  templateUrl: './reschedule-sheet.html',
  styleUrl: './reschedule-sheet.scss',
})
export class RescheduleSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly instance = input<SessionInstance | null>(null);
  /**
   * The series' zone, when the caller has the full template; the instance's
   * own short template carries it too.
   */
  readonly timezone = input<string | null>(null);
  /** The date moved; the API's answer, with who was told. */
  readonly rescheduled = output<RescheduleInstanceResponse>();

  /** The new start, as a wall clock in `zone`. */
  readonly startAt = signal('');
  readonly pickerOpen = signal(false);
  readonly saving = signal(false);
  /** "Now" for the floor and the check, pulled forward on open and on save. */
  private readonly _now = signal(Date.now());

  /** The clock the times are read on: the series' own, else the phone's. */
  readonly zone = computed(() => {
    const explicit = this.timezone();
    if (explicit) {
      return explicit;
    }
    const template = this.instance()?.template;
    if (template && template.timezone) {
      return template.timezone;
    }
    return deviceTimezone();
  });

  readonly title = computed(() => {
    const instance = this.instance();
    if (!instance) {
      return '';
    }
    if (instance.titleOverride) {
      return instance.titleOverride;
    }
    const template = instance.template;
    if (template && template.title) {
      return template.title;
    }
    return this._translateService.instant('common.session');
  });

  /** The new start as the API takes it. */
  readonly startIso = computed(() => zonedWallClockToIso(this.startAt(), this.zone()));

  /** The picker's floor: now, on the session's clock. */
  readonly startMin = computed(() => wallClockInZone(this._now(), this.zone()));

  /** The pill's face. */
  readonly startLabel = computed(() => wallClockLabel(this.startAt()));

  /** When it is now, on the same clock, under the pill. */
  readonly currentLabel = computed(() => {
    const instance = this.instance();
    if (!instance) {
      return '';
    }
    return wallClockLabel(wallClockInZone(instance.startAt, this.zone()));
  });

  /** Named only when the session's clock is not the phone's. */
  readonly zoneNote = computed(() => {
    const zone = this.zone();
    if (zone === deviceTimezone()) {
      return null;
    }
    return this._translateService.instant('sessions.rescheduleSheet.zone', { zone });
  });

  readonly startError = computed(() => {
    if (new Date(this.startIso()).getTime() >= this._now()) {
      return null;
    }
    return this._translateService.instant('sessions.form.errors.startPast');
  });

  /** The time picked is the one it already has. */
  readonly unchanged = computed(() => {
    const instance = this.instance();
    if (!instance) {
      return true;
    }
    return new Date(this.startIso()).getTime() === new Date(instance.startAt).getTime();
  });

  readonly canSave = computed(
    () => this.instance() !== null && !this.startError() && !this.unchanged(),
  );

  constructor() {
    // Seeded each time it opens, on the session's own clock. `untracked` so a
    // reload of the instance under an open sheet does not reset the pick.
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => this._reset());
    });
  }

  /** The floor is "now", so now is read as the picker opens. */
  openPicker(): void {
    this._now.set(Date.now());
    this.pickerOpen.set(true);
  }

  onStartChange(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') {
      this.startAt.set(value);
    }
  }

  save(): void {
    // The pick may have slipped into the past while the sheet sat open.
    this._now.set(Date.now());
    const instance = this.instance();
    if (!instance || !this.canSave() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this._sessionService
      .rescheduleInstance(instance.id, { newStartAt: this.startIso() })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success(this._successMessage(result));
          this.rescheduled.emit(result);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('sessions.toast.rescheduleFailed'),
          );
        },
      });
  }

  /** Who heard about it, or that it now overlaps something (the API warns, never refuses). */
  private _successMessage(result: RescheduleInstanceResponse): string {
    let warnings = 0;
    if (result.warnings) {
      warnings = result.warnings.length;
    }
    if (warnings > 0) {
      return this._translateService.instant('sessions.toast.rescheduledWithOverlap');
    }
    let told = 0;
    if (result.notifiedUserIds) {
      told = result.notifiedUserIds.length;
    }
    return this._translateService.instant('sessions.toast.rescheduled', { count: told });
  }

  private _reset(): void {
    this._now.set(Date.now());
    this.pickerOpen.set(false);
    const instance = this.instance();
    if (instance) {
      this.startAt.set(wallClockInZone(instance.startAt, this.zone()));
    } else {
      this.startAt.set(wallClockInZone(this._now(), this.zone()));
    }
  }
}
