import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import { DbRow } from '../models/admin.models';

/** Read-only admin action audit log. */
@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  private readonly _http = inject(HttpClient);

  list(page: number, limit: number, action?: string): Observable<PaginatedResponse<DbRow>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (action) params = params.set('status', action);
    return this._http.get<PaginatedResponse<DbRow>>(
      `${environment.apiUrl}/admin/audit/actions`,
      { params },
    );
  }
}
