import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import type { AssignedExercise, AssignedSet, AssignedWorkout } from '../../models/workout/assignment.model';
import type {
  CopyDayDetail,
  CopyDoneResult,
  CopyOverview,
  UpdateCopyExercisePayload,
} from '../../models/workout/client-copy.model';
import type {
  AddPrescribedExerciseItem,
  PrescribedSetItem,
  ReorderPrescribedRowsPayload,
} from '../../models/workout/program.model';

/**
 * ClientCopyService — a coach editing one client's copy of a plan
 * (`/program-assignments/:id/copy`). Every call is one request and one
 * transaction on the API, which checks the caller is the plan's coach and
 * that the day can still change. Nothing here reaches the program.
 *
 * `done` tells the client once about what changed since the last notice;
 * calling it again, or with nothing changed, sends nothing.
 */
@Injectable({ providedIn: 'root' })
export class ClientCopyService {
  private readonly _http = inject(HttpClient);
  private readonly _api = environment.apiUrl;
  private readonly _paths = API_ENDPOINTS.PROGRAM_ASSIGNMENTS;

  /** Every day of the copy in date order, each with whether it can change. */
  overview(assignmentId: string): Observable<CopyOverview> {
    return this._http.get<CopyOverview>(`${this._api}${this._paths.COPY(assignmentId)}`);
  }

  /** One day, whole: exercises, how each differs from the program, last results. */
  day(assignmentId: string, dayId: string): Observable<CopyDayDetail> {
    return this._http.get<CopyDayDetail>(`${this._api}${this._paths.COPY_DAY(assignmentId, dayId)}`);
  }

  /** Every set of one exercise, matched by id and updated in place. */
  setSets(
    assignmentId: string,
    dayId: string,
    exerciseId: string,
    sets: PrescribedSetItem[],
  ): Observable<AssignedSet[]> {
    return this._http.put<AssignedSet[]>(
      `${this._api}${this._paths.COPY_SETS(assignmentId, dayId, exerciseId)}`,
      { sets },
    );
  }

  /** Swap the movement (its sets stay) or change the coach's note on it. */
  updateExercise(
    assignmentId: string,
    dayId: string,
    exerciseId: string,
    payload: UpdateCopyExercisePayload,
  ): Observable<AssignedExercise> {
    return this._http.patch<AssignedExercise>(
      `${this._api}${this._paths.COPY_EXERCISE_BY_ID(assignmentId, dayId, exerciseId)}`,
      payload,
    );
  }

  /** Several movements added to the day in one request, with their empty sets. */
  addExercises(
    assignmentId: string,
    dayId: string,
    exercises: AddPrescribedExerciseItem[],
  ): Observable<AssignedExercise[]> {
    return this._http.post<AssignedExercise[]>(
      `${this._api}${this._paths.COPY_EXERCISES_BULK(assignmentId, dayId)}`,
      { exercises },
    );
  }

  removeExercise(assignmentId: string, dayId: string, exerciseId: string): Observable<void> {
    return this._http.delete<void>(
      `${this._api}${this._paths.COPY_EXERCISE_BY_ID(assignmentId, dayId, exerciseId)}`,
    );
  }

  reorderExercises(
    assignmentId: string,
    dayId: string,
    payload: ReorderPrescribedRowsPayload,
  ): Observable<AssignedExercise[]> {
    return this._http.patch<AssignedExercise[]>(
      `${this._api}${this._paths.COPY_EXERCISES_REORDER(assignmentId, dayId)}`,
      payload,
    );
  }

  /** The exercise, its note and sets back to its program row as it is now. */
  revert(assignmentId: string, dayId: string, exerciseId: string): Observable<AssignedExercise> {
    return this._http.post<AssignedExercise>(
      `${this._api}${this._paths.COPY_EXERCISE_REVERT(assignmentId, dayId, exerciseId)}`,
      {},
    );
  }

  /** Move the day to a free date inside the plan (`YYYY-MM-DD`), never into the past. */
  moveDay(assignmentId: string, dayId: string, date: string): Observable<AssignedWorkout> {
    return this._http.patch<AssignedWorkout>(
      `${this._api}${this._paths.COPY_DAY_DATE(assignmentId, dayId)}`,
      { date },
    );
  }

  /**
   * Done: the client is told once about the days changed since the last
   * notice. `silent` keeps a failure out of the error dialog, for the call
   * made on the way out of the copy, when nobody is there to read it.
   */
  done(assignmentId: string, opts?: { silent?: boolean }): Observable<CopyDoneResult> {
    const url = `${this._api}${this._paths.COPY_DONE(assignmentId)}`;
    if (opts && opts.silent) {
      return this._http.post<CopyDoneResult>(url, {}, { context: silentRequest() });
    }
    return this._http.post<CopyDoneResult>(url, {});
  }
}
