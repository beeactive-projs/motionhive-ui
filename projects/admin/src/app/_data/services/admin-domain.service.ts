import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import { DbRow } from '../models/admin.models';

export type DomainResource = 'groups' | 'sessions' | 'venues' | 'exercises';

/** Curated domain browsers + group soft-delete. */
@Injectable({ providedIn: 'root' })
export class AdminDomainService {
  private readonly _http = inject(HttpClient);
  private readonly _api = environment.apiUrl;

  list(
    resource: DomainResource,
    page: number,
    limit: number,
    q?: string,
    status?: string,
  ): Observable<PaginatedResponse<DbRow>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (q) params = params.set('q', q);
    if (status) params = params.set('status', status);
    return this._http.get<PaginatedResponse<DbRow>>(
      `${this._api}/admin/domain/${resource}`,
      { params },
    );
  }

  deleteGroup(id: string): Observable<DbRow> {
    return this._http.delete<DbRow>(`${this._api}/admin/domain/groups/${id}`);
  }

  deleteExercise(id: string): Observable<DbRow> {
    return this._http.delete<DbRow>(`${this._api}/admin/domain/exercises/${id}`);
  }

  getExercise(id: string): Observable<DbRow> {
    return this._http.get<DbRow>(`${this._api}/admin/domain/exercises/${id}`);
  }

  updateExercise(id: string, payload: Record<string, unknown>): Observable<DbRow> {
    return this._http.patch<DbRow>(
      `${this._api}/admin/domain/exercises/${id}`,
      payload,
    );
  }
}
