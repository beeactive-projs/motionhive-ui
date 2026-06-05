import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import {
  AdminUserDetail,
  AdminUserFilters,
  AdminUserListItem,
  UpdateUserStatusPayload,
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}/admin/users`;

  list(filters: AdminUserFilters): Observable<PaginatedResponse<AdminUserListItem>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this._http.get<PaginatedResponse<AdminUserListItem>>(this._baseUrl, {
      params,
    });
  }

  get(id: string): Observable<AdminUserDetail> {
    return this._http.get<AdminUserDetail>(`${this._baseUrl}/${id}`);
  }

  updateStatus(
    id: string,
    payload: UpdateUserStatusPayload,
  ): Observable<AdminUserDetail> {
    return this._http.patch<AdminUserDetail>(
      `${this._baseUrl}/${id}/status`,
      payload,
    );
  }

  assignRole(id: string, role: string): Observable<{ roles: string[] }> {
    return this._http.post<{ roles: string[] }>(`${this._baseUrl}/${id}/roles`, {
      role,
    });
  }

  revokeRole(id: string, role: string): Observable<{ roles: string[] }> {
    return this._http.delete<{ roles: string[] }>(
      `${this._baseUrl}/${id}/roles/${role}`,
    );
  }

  restore(id: string): Observable<AdminUserDetail> {
    return this._http.post<AdminUserDetail>(`${this._baseUrl}/${id}/restore`, {});
  }
}
