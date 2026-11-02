import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import type {
  UpdateWorkoutSettingsPayload,
  WorkoutSettings,
} from '../../models/workout/workout-settings.model';

/** The person's logger settings, on their account so every phone shares them. */
@Injectable({ providedIn: 'root' })
export class WorkoutSettingsService {
  private readonly _http = inject(HttpClient);
  private readonly _url = `${environment.apiUrl}${API_ENDPOINTS.USERS.ME_WORKOUT_SETTINGS}`;

  /** Silent: the logger works on the defaults if this fails. */
  get(): Observable<WorkoutSettings> {
    return this._http.get<WorkoutSettings>(this._url, { context: silentRequest() });
  }

  update(payload: UpdateWorkoutSettingsPayload): Observable<WorkoutSettings> {
    return this._http.patch<WorkoutSettings>(this._url, payload);
  }
}
