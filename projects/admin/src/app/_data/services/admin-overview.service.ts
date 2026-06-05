import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'core';
import { AdminOverview } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminOverviewService {
  private readonly _http = inject(HttpClient);

  get(): Observable<AdminOverview> {
    return this._http.get<AdminOverview>(`${environment.apiUrl}/admin/overview`);
  }
}
