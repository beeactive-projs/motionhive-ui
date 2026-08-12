import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type {
  RosterSummary,
  RosterWindow,
} from '../../models/workout/roster.model';

/** Read-only. The roster is derived; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly _http = inject(HttpClient);

  roster(window: RosterWindow = '4w'): Observable<RosterSummary> {
    return this._http.get<RosterSummary>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COACH_ROSTER}`,
      { params: new HttpParams().set('window', window) },
    );
  }
}
