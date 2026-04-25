import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  DashboardLinkResponse,
  OnboardingStartPayload,
  OnboardingStartResponse,
  OnboardingStatusResponse,
} from '../../models/payment/stripe-account.model';

@Injectable({ providedIn: 'root' })
export class StripeOnboardingService {
  private readonly _http = inject(HttpClient);

  start(payload: OnboardingStartPayload = {}): Observable<OnboardingStartResponse> {
    return this._http.post<OnboardingStartResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.ONBOARDING_START}`,
      payload,
    );
  }

  getStatus(): Observable<OnboardingStatusResponse> {
    return this._http.get<OnboardingStatusResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.ONBOARDING_STATUS}`,
    );
  }

  /**
   * Force a live pull from Stripe instead of trusting the local
   * cache. Use this as a "Refresh" button action when the user
   * returned from the hosted onboarding flow but the webhook
   * hasn't arrived yet (common on localhost without `stripe
   * listen`).
   */
  refreshStatus(): Observable<OnboardingStatusResponse> {
    return this._http.post<OnboardingStatusResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.ONBOARDING_REFRESH_STATUS}`,
      {},
    );
  }

  getDashboardLink(): Observable<DashboardLinkResponse> {
    return this._http.post<DashboardLinkResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.ONBOARDING_DASHBOARD_LINK}`,
      {},
    );
  }
}
