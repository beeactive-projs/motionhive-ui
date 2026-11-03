import { Service, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, defer } from 'rxjs';
import { catchError, finalize, take, tap } from 'rxjs/operators';

import { Routine, RoutineService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';

/**
 * The requests and toasts behind a routine's More verbs, shared by the
 * Workouts list and the routine's own page so the two cannot drift. Each
 * screen decides what happens around them: which sheet closes, where it goes
 * next, what it patches.
 *
 * A routine with a request on the way takes no second one, so a double tap,
 * or the same verb from both screens, sends it once. A failure is toasted
 * here and ends the stream quietly; a screen resets its own flags in
 * `finalize`.
 */
@Service()
export class RoutineActionsService {
  private readonly _routineService = inject(RoutineService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  /** Routines with a request on the way. */
  private readonly _pending = new Set<string>();

  /** A copy owned by the caller; the screen opens it, since the copy is the one to change. */
  copy(id: string): Observable<Routine> {
    return this._run(
      id,
      () => this._routineService.duplicate(id),
      'workouts.routineBuilder.toast.copied',
      'workouts.routineBuilder.toast.copyFailed',
    );
  }

  /** Put away or brought back. Each undoes the other in one tap, so neither asks first. */
  setArchived(id: string, archive: boolean): Observable<Routine> {
    return this._run(
      id,
      () => (archive ? this._routineService.archive(id) : this._routineService.restore(id)),
      archive
        ? 'workouts.routineBuilder.archive.done'
        : 'workouts.routineBuilder.archive.unarchived',
      'workouts.routineBuilder.archive.failed',
    );
  }

  /** After the red confirm. The workouts logged from it stay in History. */
  remove(id: string): Observable<void> {
    return this._run(
      id,
      () => this._routineService.remove(id),
      'workouts.routineBuilder.toast.deleted',
      'workouts.routineBuilder.toast.deleteFailed',
    );
  }

  private _run<T>(
    id: string,
    request: () => Observable<T>,
    doneKey: string,
    failedKey: string,
  ): Observable<T> {
    return defer(() => {
      if (this._pending.has(id)) return EMPTY;
      this._pending.add(id);
      return request().pipe(
        take(1),
        tap(() => void this._feedbackService.success(this._translateService.instant(doneKey))),
        catchError((err: unknown) => {
          void this._feedbackService.error(err, this._translateService.instant(failedKey));
          return EMPTY;
        }),
        finalize(() => this._pending.delete(id)),
      );
    });
  }
}
