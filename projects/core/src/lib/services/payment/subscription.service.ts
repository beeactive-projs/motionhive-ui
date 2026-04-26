import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  SetupLinkResponse,
  Subscription,
  SubscriptionListParams,
  SubscriptionListResponse,
} from '../../models/payment/subscription.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.SUBSCRIPTIONS}`;

  list(params: SubscriptionListParams = {}): Observable<SubscriptionListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.clientId) httpParams = httpParams.set('clientId', params.clientId);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<SubscriptionListResponse>(this.baseUrl, { params: httpParams });
  }

  get(id: string): Observable<Subscription> {
    return this._http.get<Subscription>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.SUBSCRIPTION_BY_ID(id)}`,
    );
  }

  create(payload: CreateSubscriptionPayload): Observable<Subscription> {
    return this._http.post<Subscription>(this.baseUrl, payload);
  }

  cancel(id: string, payload: CancelSubscriptionPayload = {}): Observable<Subscription> {
    return this._http.post<Subscription>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.SUBSCRIPTION_CANCEL(id)}`,
      payload,
    );
  }

  /**
   * Mint a fresh Stripe Checkout setup URL for an INCOMPLETE
   * subscription (so the client can save their card). The backend
   * returns `{ url: null }` when the subscription is no longer
   * INCOMPLETE — the UI should hide the action in that case.
   */
  getSetupLink(id: string): Observable<SetupLinkResponse> {
    return this._http.post<SetupLinkResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.SUBSCRIPTION_SETUP_LINK(id)}`,
      {},
    );
  }
}
