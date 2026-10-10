import { Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';

interface StartOptions {
  isSame?: (open: WorkoutLog) => boolean;
  onBlocked?: (open: WorkoutLog) => void;
  /** Replace the current URL — for a route that itself means "start". */
  replaceUrl?: boolean;
}

/**
 * One workout at a time.
 *
 * Every way of starting a session (a plan's day, a routine, an empty or
 * repeated workout) asks here first. With a session already open, nothing new
 * starts: the user is taken to the open one, told why, and can finish or
 * discard it there. The API refuses a second start too; this is so that
 * refusal is never what the user sees.
 */
@Service()
export class ActiveWorkoutService {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  /**
   * Runs `start` when no workout is open; otherwise resumes the open one.
   *
   * `isSame` recognises the open session as the very one being started — a
   * plan's day begun earlier and left — which resumes without the warning,
   * since nothing is being refused. `onBlocked` lets the caller reset its
   * own state (a spinner, a store) before the page changes.
   */
  startOrResume(start: () => void, options: StartOptions = {}): void {
    this._workoutLogService
      .getInProgress()
      // A failed check must not block training; the API still holds the line.
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((open) => {
        if (!open) {
          start();
          return;
        }
        options.onBlocked?.(open);
        this.resume(open, !options.isSame?.(open), options.replaceUrl ?? false);
      });
  }

  /** Opens the in-progress session, saying why when the user asked for another. */
  resume(open: WorkoutLog, explain = true, replaceUrl = false): void {
    if (explain) {
      void this._feedbackService.info(
        this._translateService.instant('workouts.common.alreadyInProgress', { name: open.name }),
      );
    }
    void this._router.navigate(['/tabs/workouts/log', open.id], { replaceUrl });
  }
}
