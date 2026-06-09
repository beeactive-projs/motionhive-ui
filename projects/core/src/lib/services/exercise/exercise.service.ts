import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type { Equipment } from '../../models/exercise/equipment.model';
import type {
  CreateExercisePayload,
  Exercise,
  ListExercisesQuery,
  PaginatedExercises,
  UpdateExercisePayload,
} from '../../models/exercise/exercise.model';
import type { Muscle } from '../../models/exercise/muscle.model';

/**
 * ExerciseService — REST wrapper over `/exercises`, `/muscles`, and
 * `/equipment`. Ownership / visibility / browse-gate are enforced
 * server-side; the FE just sends the authenticated JWT (auth
 * interceptor handles that).
 *
 * Array query params (kind / muscle / equipment / level / ...) are
 * sent as comma-separated strings to match the BE DTO's Transform.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}${API_ENDPOINTS.EXERCISES.BASE}`;
  private readonly _musclesUrl = `${environment.apiUrl}${API_ENDPOINTS.MUSCLES.BASE}`;
  private readonly _equipmentUrl = `${environment.apiUrl}${API_ENDPOINTS.EQUIPMENT.BASE}`;

  // ── Catalog ──────────────────────────────────────────────────────

  list(query: ListExercisesQuery = {}): Observable<PaginatedExercises> {
    return this._http.get<PaginatedExercises>(this._baseUrl, {
      params: this.toParams(query),
    });
  }

  get(id: string): Observable<Exercise> {
    return this._http.get<Exercise>(
      `${environment.apiUrl}${API_ENDPOINTS.EXERCISES.BY_ID(id)}`,
    );
  }

  create(payload: CreateExercisePayload): Observable<Exercise> {
    return this._http.post<Exercise>(this._baseUrl, payload);
  }

  update(id: string, payload: UpdateExercisePayload): Observable<Exercise> {
    return this._http.patch<Exercise>(
      `${environment.apiUrl}${API_ENDPOINTS.EXERCISES.BY_ID(id)}`,
      payload,
    );
  }

  remove(id: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.EXERCISES.BY_ID(id)}`,
    );
  }

  /** Returns 409 from the BE if this owner already has a live fork of the source. */
  fork(id: string): Observable<Exercise> {
    return this._http.post<Exercise>(
      `${environment.apiUrl}${API_ENDPOINTS.EXERCISES.FORK(id)}`,
      {},
    );
  }

  // ── Taxonomy (read-only reference data) ──────────────────────────

  listMuscles(): Observable<Muscle[]> {
    return this._http.get<Muscle[]>(this._musclesUrl);
  }

  listEquipment(): Observable<Equipment[]> {
    return this._http.get<Equipment[]>(this._equipmentUrl);
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Coerce the typed query into HttpParams. Arrays become a single
   * comma-separated string (e.g. `?kind=STRENGTH,CARDIO`) — matches
   * the BE DTO's `@Transform(toStringArray)` shape. Undefined values
   * are dropped so the URL stays clean.
   */
  private toParams(query: ListExercisesQuery): HttpParams {
    let p = new HttpParams();
    const set = (key: string, value: string | number | boolean | undefined) => {
      if (value === undefined || value === null || value === '') return;
      p = p.set(key, String(value));
    };
    set('page', query.page);
    set('limit', query.limit);
    set('search', query.search);
    set('ownership', query.ownership);
    set('sort', query.sort);
    set('withFacets', query.withFacets);
    if (query.kind?.length) p = p.set('kind', query.kind.join(','));
    if (query.level?.length) p = p.set('level', query.level.join(','));
    if (query.movementPattern?.length)
      p = p.set('movementPattern', query.movementPattern.join(','));
    if (query.mechanic?.length) p = p.set('mechanic', query.mechanic.join(','));
    if (query.force?.length) p = p.set('force', query.force.join(','));
    if (query.primaryMuscleId?.length)
      p = p.set('primaryMuscleId', query.primaryMuscleId.join(','));
    if (query.equipmentId?.length)
      p = p.set('equipmentId', query.equipmentId.join(','));
    return p;
  }
}
