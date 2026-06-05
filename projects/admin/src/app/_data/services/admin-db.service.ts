import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import { DbRow, DbTableInfo } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminDbService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}/admin/db`;

  tables(): Observable<{ tables: DbTableInfo[] }> {
    return this._http.get<{ tables: DbTableInfo[] }>(`${this._baseUrl}/tables`);
  }

  rows(
    table: string,
    page: number,
    limit: number,
  ): Observable<PaginatedResponse<DbRow>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this._http.get<PaginatedResponse<DbRow>>(
      `${this._baseUrl}/tables/${table}`,
      { params },
    );
  }
}
