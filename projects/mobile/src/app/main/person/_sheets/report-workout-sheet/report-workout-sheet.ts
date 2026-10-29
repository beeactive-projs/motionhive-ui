import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IonIcon, IonItem, IonLabel, IonList, IonTextarea } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';

import { MessageReportCategory, ProfileService, ProfileWorkout, translate } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';

/** The reasons offered, most serious first; a message report's categories. */
export const WORKOUT_REPORT_CATEGORIES: readonly MessageReportCategory[] = [
  'SEXUAL',
  'HARASSMENT',
  'SPAM',
  'SCAM',
  'IMPERSONATION',
  'OTHER',
];

/** As long as the server keeps a report's notes. */
export const REPORT_NOTES_MAX_LENGTH = 1000;

/**
 * Report a workout someone shows on their profile: one reason, an optional
 * note, sent to the MotionHive team. The owner is never told who reported
 * it. The sheet sends the report itself and closes once it has gone.
 */
@Component({
  selector: 'mh-report-workout-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './report-workout-sheet.html',
  styleUrl: './report-workout-sheet.scss',
})
export class ReportWorkoutSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedback = inject(FeedbackService);

  readonly open = model(false);
  readonly workout = input<ProfileWorkout | null>(null);
  readonly handle = input.required<string>();
  /** Whose workout it is, for the line that says they won't know. */
  readonly ownerName = input('');

  readonly categories = WORKOUT_REPORT_CATEGORIES;
  readonly notesMaxLength = REPORT_NOTES_MAX_LENGTH;

  readonly category = signal<MessageReportCategory | null>(null);
  readonly notes = signal('');
  readonly sending = signal(false);

  readonly canSend = computed(() => this.category() !== null && !this.sending());

  constructor() {
    addIcons({ checkmarkOutline });
    // Every report starts blank: a reason picked for one workout is not
    // carried to the next.
    effect(() => {
      if (this.open()) {
        this.category.set(null);
        this.notes.set('');
      }
    });
  }

  send(): void {
    const workout = this.workout();
    const category = this.category();
    if (!workout || !category || this.sending()) return;
    this.sending.set(true);
    const notes = this.notes().trim();
    this._profileService
      .reportUserWorkout(this.handle(), workout.id, { category, ...(notes ? { notes } : {}) })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.open.set(false);
          void this._feedback.success(translate('person.workouts.report.sent'));
        },
        error: (error: unknown) => {
          this.sending.set(false);
          void this._feedback.error(error, translate('person.workouts.report.failed'));
        },
      });
  }
}
