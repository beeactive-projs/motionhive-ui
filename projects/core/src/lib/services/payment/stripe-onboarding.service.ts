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

  getDashboardLink(): Observable<DashboardLinkResponse> {
    return this._http.post<DashboardLinkResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.ONBOARDING_DASHBOARD_LINK}`,
      {},
    );
  }
}
