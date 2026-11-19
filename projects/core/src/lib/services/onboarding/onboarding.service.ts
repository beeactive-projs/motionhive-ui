import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { silentRequest } from '../../interceptors/silent-request.context';
import type { OnboardingRole, OnboardingStep } from '../../models/onboarding/onboarding.enums';
import type {
  OnboardingState,
  SetCoachCategoriesPayload,
  SetCoachDetailsPayload,
  SetLevelPayload,
} from '../../models/onboarding/onboarding.model';

/**
 * The reader's welcome flow (`/users/me/onboarding`). Every write answers
 * with the new state, so the caller moves on without a second read.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}${API_ENDPOINTS.ONBOARDING.BASE}`;

  /**
   * Silent: the app decides on its own whether to open the flow, and a
   * failed read just means it does not (it asks again next time).
   */
  getState(): Observable<OnboardingState> {
    return this._http.get<OnboardingState>(this._baseUrl, { context: silentRequest() });
  }

  answerRole(role: OnboardingRole): Observable<OnboardingState> {
    return this._http.put<OnboardingState>(`${this._baseUrl}/role`, { role });
  }

  setInterests(categoryIds: string[]): Observable<OnboardingState> {
    return this._http.put<OnboardingState>(`${this._baseUrl}/interests`, { categoryIds });
  }

  setLevel(payload: SetLevelPayload): Observable<OnboardingState> {
    return this._http.put<OnboardingState>(`${this._baseUrl}/level`, payload);
  }

  setCoachCategories(payload: SetCoachCategoriesPayload): Observable<OnboardingState> {
    return this._http.put<OnboardingState>(`${this._baseUrl}/coach-categories`, payload);
  }

  setCoachDetails(payload: SetCoachDetailsPayload): Observable<OnboardingState> {
    return this._http.put<OnboardingState>(`${this._baseUrl}/coach-details`, payload);
  }

  /** Silent: skipping is never worth an error dialog; the flow moves on regardless. */
  skip(steps: OnboardingStep[]): Observable<OnboardingState> {
    return this._http.post<OnboardingState>(
      `${this._baseUrl}/skip`,
      { steps },
      { context: silentRequest() },
    );
  }

  /** Silent, like `skip`: a closed card stays closed on this phone either way. */
  dismiss(steps: OnboardingStep[]): Observable<OnboardingState> {
    return this._http.post<OnboardingState>(
      `${this._baseUrl}/dismiss`,
      { steps },
      { context: silentRequest() },
    );
  }
}
