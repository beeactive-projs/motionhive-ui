import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import type {
  RosterSummary,
  RosterWindow,
} from '../../models/workout/roster.model';

/** Read-only. The roster is derived; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly _http = inject(HttpClient);

  /**
   * `silent` opts the call out of the global error dialog, for screens that
   * report a failed load themselves. The Clients triage refreshes on every
   * entry and keeps its stale rows with an inline bar over them; a blocking
   * alert on top of that is the same failure said three times.
   */
  roster(window: RosterWindow = '4w', opts?: { silent?: boolean }): Observable<RosterSummary> {
    return this._http.get<RosterSummary>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COACH_ROSTER}`,
      {
        params: new HttpParams().set('window', window),
        ...(opts?.silent ? { context: silentRequest() } : {}),
      },
    );
  }
}
