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
import {
  IonIcon,
  IonPicker,
  IonPickerColumn,
  IonPickerColumnOption,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { WorkoutLog, WorkoutLogService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { SHARE_ICONS, SHARE_ICON_NAMES } from '../../_services/share-card.config';
import {
  HOUR_CHOICES,
  MINUTE_CHOICES,
  durationWords,
  joinDuration,
  recordedSeconds,
  settleWheels,
  splitDuration,
} from './adjust-duration.config';

/** Long enough for the wheel to land before it is turned back. */
const SNAP_DELAY_MS = 350;

/**
 * Adjust duration, from the share sheet's Duration row (design "Share v3",
 * 2): hour and minute wheels, Ionic's own picker. It corrects the workout
 * itself, not only the picture: History, Progress and the card read the
 * new length, and the sheet says so, with what the clock recorded beside
 * it. The owner only reaches it from their own finished workout.
 */
@Component({
  selector: 'mh-adjust-duration-sheet',
  imports: [IonIcon, IonPicker, IonPickerColumn, IonPickerColumnOption, SheetShell, TranslatePipe],
  templateUrl: './adjust-duration-sheet.html',
  styleUrl: './adjust-duration-sheet.scss',
})
export class AdjustDurationSheet {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly log = input.required<WorkoutLog>();
  /** The new length in seconds, once the API has it. */
  readonly saved = output<number>();

  readonly icons = SHARE_ICON_NAMES;
  readonly hourChoices = HOUR_CHOICES;
  readonly minuteChoices = MINUTE_CHOICES;

  readonly hours = signal(0);
  readonly minutes = signal(0);
  readonly saving = signal(false);

  readonly seconds = computed(() => joinDuration(this.hours(), this.minutes()));
  readonly next = computed(() => durationWords(this.seconds()));
  /** "Recorded: 52 min.", what the clock measured, so the correction is a choice made knowingly. */
  readonly recordedLine = computed(() => {
    const seconds = recordedSeconds(this.log());
    return seconds == null
      ? this._translateService.instant('workouts.share.duration.recordedUnknown')
      : this._translateService.instant('workouts.share.duration.recorded', {
          recorded: durationWords(seconds),
        });
  });
  /** Nothing to save until the wheels say something else. */
  readonly changed = computed(() => this.seconds() !== this.log().durationSeconds);

  constructor() {
    addIcons(SHARE_ICONS);
    // Each opening starts from the workout's length (or what the clock
    // recorded, when the length is unknown).
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const log = this.log();
        const { hours, minutes } = splitDuration(
          log.durationSeconds ?? recordedSeconds(log) ?? 3600,
        );
        this.hours.set(hours);
        this.minutes.set(minutes);
      });
    });
  }

  setHours(value: unknown): void {
    const hours = Number(value);
    if (Number.isFinite(hours)) this._settle(hours, this.minutes());
  }

  setMinutes(value: unknown): void {
    const minutes = Number(value);
    if (Number.isFinite(minutes)) this._settle(this.hours(), minutes);
  }

  /**
   * Takes the pick, then snaps an impossible one back (`settleWheels`) a
   * moment later, so the wheel the person moved turns back to where the
   * value is.
   */
  private _settle(hours: number, minutes: number): void {
    this.hours.set(hours);
    this.minutes.set(minutes);
    const settled = settleWheels(hours, minutes);
    if (settled.minutes !== minutes) {
      setTimeout(() => this.minutes.set(settled.minutes), SNAP_DELAY_MS);
    }
  }

  save(): void {
    if (this.saving()) return;
    if (!this.changed()) {
      this.open.set(false);
      return;
    }
    const seconds = this.seconds();
    this.saving.set(true);
    this._workoutLogService
      .setDuration(this.log().id, seconds)
      .pipe(take(1))
      .subscribe({
        next: ({ durationSeconds }) => {
          this.saving.set(false);
          this.saved.emit(durationSeconds);
          this.open.set(false);
          void this._feedbackService.success(
            this._translateService.instant('workouts.share.duration.saved', {
              duration: durationWords(durationSeconds),
            }),
          );
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.share.duration.failed'),
          );
        },
      });
  }
}
