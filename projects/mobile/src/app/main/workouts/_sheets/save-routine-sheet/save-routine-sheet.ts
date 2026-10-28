import { Component, effect, inject, signal } from '@angular/core';
import { IonInput } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

import { WorkoutLogService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { SaveRoutineService } from '../../_services/save-routine.service';

/** `SaveLogAsRoutineDto.name` on the API. */
const NAME_MAX_LENGTH = 200;

/**
 * Names a finished freestyle workout and keeps it as a routine to repeat.
 * Hosted once by the tabs layout and opened through `SaveRoutineService`.
 */
@Component({
  selector: 'mh-save-routine-sheet',
  imports: [IonInput, SheetShell, TranslatePipe],
  templateUrl: './save-routine-sheet.html',
})
export class SaveRoutineSheet {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  readonly service = inject(SaveRoutineService);

  readonly maxLength = NAME_MAX_LENGTH;
  readonly name = signal('');
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const request = this.service.request();
      if (request) this.name.set(request.suggestedName);
    });
  }

  onOpenChange(open: boolean): void {
    if (!open) this.service.close();
  }

  save(): void {
    const request = this.service.request();
    const name = this.name().trim();
    if (!request || !name || this.saving()) return;

    this.saving.set(true);
    this._workoutLogService
      .saveAsRoutine(request.logId, { name })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.service.markSaved(request.logId, name);
          this.service.close();
          void this._feedbackService.success(
            this._translateService.instant('workouts.finish.toast.routineSaved', { name }),
          );
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.finish.toast.routineSaveFailed'),
          );
        },
      });
  }
}
