import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { silentRequest } from '../../interceptors/silent-request.context';
import type {
  ExerciseProgress,
  ProgressOverview,
  ProgressRange,
  TrainedExercise,
} from '../../models/workout/progress.model';

const BASE = '/progress';
const COACH_BASE = (clientId: string) => `/coach/clients/${clientId}/progress`;

/** Read-only. Progress is derived; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${BASE}`;

  /**
   * `silent` opts the read out of the global error dialog, for a screen that
   * shows its own failure or empty state (Home's week line, Latest).
   */
  overview(
    range: ProgressRange = '12w',
    opts?: { silent?: boolean },
  ): Observable<ProgressOverview> {
    return this._http.get<ProgressOverview>(`${this._base}/overview`, {
      params: new HttpParams().set('range', range),
      ...(opts?.silent ? { context: silentRequest() } : {}),
    });
  }

  /** Every exercise the caller has trained, most recent first (the Progress list). */
  trainedExercises(opts?: { silent?: boolean }): Observable<TrainedExercise[]> {
    return this._http.get<TrainedExercise[]>(`${this._base}/exercises`, {
      ...(opts?.silent ? { context: silentRequest() } : {}),
    });
  }

  /** `silent` for a read whose screen copes without it (a workout's "vs last time"). */
  forExercise(exerciseId: string, opts?: { silent?: boolean }): Observable<ExerciseProgress> {
    return this._http.get<ExerciseProgress>(`${this._base}/exercises/${exerciseId}`, {
      ...(opts?.silent ? { context: silentRequest() } : {}),
    });
  }

  /**
   * A coach's read of one client's progress: the same shape as `overview`,
   * built only from the workouts that client lets this coach see (their
   * plans, plus off-plan training when the client shares it).
   *
   * Both coach reads are silent: their screens own the loading and error
   * states, and the global dialog stacked a second, rawer error on top.
   */
  overviewForClient(
    clientId: string,
    range: ProgressRange = '12w',
  ): Observable<ProgressOverview> {
    return this._http.get<ProgressOverview>(
      `${environment.apiUrl}${COACH_BASE(clientId)}/overview`,
      { params: new HttpParams().set('range', range), context: silentRequest() },
    );
  }

  /** Every exercise a client has trained, under the same visibility rule. */
  trainedExercisesForClient(clientId: string): Observable<TrainedExercise[]> {
    return this._http.get<TrainedExercise[]>(
      `${environment.apiUrl}${COACH_BASE(clientId)}/exercises`,
      { context: silentRequest() },
    );
  }

  /** One exercise's history for a client, under the same visibility rule. */
  forClientExercise(clientId: string, exerciseId: string): Observable<ExerciseProgress> {
    return this._http.get<ExerciseProgress>(
      `${environment.apiUrl}${COACH_BASE(clientId)}/exercises/${exerciseId}`,
      { context: silentRequest() },
    );
  }
}
