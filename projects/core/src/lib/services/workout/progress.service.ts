import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { silentRequest } from '../../interceptors/silent-request.context';
import type {
  ExerciseProgress,
  ProgressOverview,
  ProgressRange,
} from '../../models/workout/progress.model';

const BASE = '/progress';
const COACH_BASE = (clientId: string) => `/coach/clients/${clientId}/progress`;

/** Read-only. Progress is derived; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${BASE}`;

  overview(range: ProgressRange = '12w'): Observable<ProgressOverview> {
    return this._http.get<ProgressOverview>(`${this._base}/overview`, {
      params: new HttpParams().set('range', range),
    });
  }

  forExercise(exerciseId: string): Observable<ExerciseProgress> {
    return this._http.get<ExerciseProgress>(
      `${this._base}/exercises/${exerciseId}`,
    );
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

  /** One exercise's history for a client, under the same visibility rule. */
  forClientExercise(clientId: string, exerciseId: string): Observable<ExerciseProgress> {
    return this._http.get<ExerciseProgress>(
      `${environment.apiUrl}${COACH_BASE(clientId)}/exercises/${exerciseId}`,
      { context: silentRequest() },
    );
  }
}
