import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  CreateRoutinePayload,
  ListRoutinesQuery,
  PaginatedRoutines,
  Routine,
  UpdateRoutinePayload,
} from '../../models/workout/routine.model';
import type { WorkoutLog } from '../../models/workout/log.model';

const BASE = '/routines';

/**
 * Saved workout shapes (per-user templates). CRUD + `start()` — start
 * returns a fresh `WorkoutLog` with no assignment; the FE then navigates
 * to `/my/workout-log/:id` to land on the active log.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${BASE}`;

  list(query: ListRoutinesQuery = {}): Observable<PaginatedRoutines> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    return this._http.get<PaginatedRoutines>(this._base, { params: p });
  }

  get(id: string): Observable<Routine> {
    return this._http.get<Routine>(`${this._base}/${id}`);
  }

  create(payload: CreateRoutinePayload): Observable<Routine> {
    return this._http.post<Routine>(this._base, payload);
  }

  update(id: string, payload: UpdateRoutinePayload): Observable<Routine> {
    return this._http.patch<Routine>(`${this._base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this._http.delete<void>(`${this._base}/${id}`);
  }

  /** One-tap start — returns the fresh WorkoutLog. */
  start(id: string): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(`${this._base}/${id}/start`, {});
  }
}
