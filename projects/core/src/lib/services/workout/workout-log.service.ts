import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type {
  CompleteWorkoutPayload,
  LogSetPayload,
  LoggedSet,
  StartWorkoutPayload,
  WorkoutLog,
} from '../../models/workout/log.model';

export interface PaginatedWorkoutLogs {
  items: WorkoutLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListWorkoutLogsQuery {
  page?: number;
  limit?: number;
}

/**
 * Client workout-log lifecycle: start → log set → complete. The BE
 * hydrates the log tree from the assignment on start, so the FE only
 * needs to PATCH individual sets as the client works through them.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutLogService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BASE}`;

  start(payload: StartWorkoutPayload): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(this._base, payload);
  }

  get(id: string): Observable<WorkoutLog> {
    return this._http.get<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BY_ID(id)}`,
    );
  }

  logSet(
    workoutLogId: string,
    setId: string,
    payload: LogSetPayload,
  ): Observable<LoggedSet> {
    return this._http.patch<LoggedSet>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.LOG_SET(workoutLogId, setId)}`,
      payload,
    );
  }

  complete(
    id: string,
    payload: CompleteWorkoutPayload = {},
  ): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COMPLETE(id)}`,
      payload,
    );
  }

  /**
   * History — completed workout logs for the signed-in user, newest
   * first. BE eager-loads the assignment + lightweight set list so the
   * row metric "18 sets" computes client-side without a follow-up hit.
   */
  list(query: ListWorkoutLogsQuery = {}): Observable<PaginatedWorkoutLogs> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    return this._http.get<PaginatedWorkoutLogs>(this._base, { params: p });
  }
}
