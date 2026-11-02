import { Service, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { WorkoutLog, WorkoutLogService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveSessionStore } from './active-session.store';

interface StartOptions {
  /** The open workout is the very one being started: just carry on with it. */
  isSame?: (open: WorkoutLog) => boolean;
  /** Called when the open workout is resumed instead of a new one starting. */
  onBlocked?: (open: WorkoutLog) => void;
  replaceUrl?: boolean;
}

/** What to do with the workout already open. */
export const StartConflictChoices = {
  Resume: 'resume',
  FinishAndStart: 'finish-and-start',
  DiscardAndStart: 'discard-and-start',
} as const;
export type StartConflictChoice = (typeof StartConflictChoices)[keyof typeof StartConflictChoices];

/** A start that found another workout open, waiting on the person's choice. */
interface Conflict {
  open: WorkoutLog;
  start: () => void;
  options: StartOptions;
}

/**
 * One workout at a time.
 *
 * Every way of starting a session (a plan's day, a routine, an empty or
 * repeated workout) asks here first. With another session open, the person
 * chooses (Workouts R2, Active Workout): resume it, finish it and start, or
 * discard it and start. The API refuses a second start too; this is so that
 * refusal is never what the user sees. The sheet lives beside the tab bar
 * (`StartConflictSheet`), so it works from any screen.
 */
@Service()
export class ActiveWorkoutService {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _activeSession = inject(ActiveSessionStore);

  private readonly _conflict = signal<Conflict | null>(null);
  /** The workout already open, while the choice is being made. */
  readonly conflict = this._conflict.asReadonly();
  readonly busy = signal(false);

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
        if (options.isSame?.(open)) {
          options.onBlocked?.(open);
          this.resume(open, false, options.replaceUrl ?? false);
          return;
        }
        this._conflict.set({ open, start, options });
      });
  }

  /** The person chose; null when the sheet was closed without a choice. */
  choose(choice: StartConflictChoice | null): void {
    const conflict = this._conflict();
    if (!conflict || this.busy()) return;
    const { open, start, options } = conflict;

    if (choice === null || choice === StartConflictChoices.Resume) {
      this._conflict.set(null);
      options.onBlocked?.(open);
      if (choice === StartConflictChoices.Resume) {
        this.resume(open, false, options.replaceUrl ?? false);
      }
      return;
    }

    const end: Observable<unknown> =
      choice === StartConflictChoices.FinishAndStart
        ? this._workoutLogService.complete(open.id)
        : this._workoutLogService.discard(open.id);
    this.busy.set(true);
    end.pipe(take(1)).subscribe({
      next: () => {
        this.busy.set(false);
        this._conflict.set(null);
        this._activeSession.end();
        start();
      },
      error: (err) => {
        this.busy.set(false);
        this._conflict.set(null);
        options.onBlocked?.(open);
        void this._feedbackService.error(
          err,
          this._translateService.instant('workouts.startConflict.failed'),
        );
      },
    });
  }

  resume(open: WorkoutLog, explain = true, replaceUrl = false): void {
    if (explain) {
      void this._feedbackService.info(
        this._translateService.instant('workouts.common.alreadyInProgress', { name: open.name }),
      );
    }
    void this._router.navigate(['/tabs/workouts/log', open.id], { replaceUrl });
  }
}
