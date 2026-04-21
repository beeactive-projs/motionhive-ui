import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  Invoice,
  InvoiceLineItemDetail,
  InvoiceListParams,
  InvoiceListResponse,
  PayInvoiceConsent,
  PayInvoiceResponse,
} from '../../models/payment/invoice.model';
import {
  SubscriptionListParams,
  SubscriptionListResponse,
} from '../../models/payment/subscription.model';

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface CustomerPortalLinkResponse {
  url: string;
}

export interface MyBillingCounts {
  invoices: { total: number; open: number };
  memberships: { total: number; active: number };
}

@Injectable({ providedIn: 'root' })
export class ClientPaymentService {
  private readonly _http = inject(HttpClient);

  createSetupIntent(): Observable<SetupIntentResponse> {
    return this._http.post<SetupIntentResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.CUSTOMER_SETUP_INTENT}`,
      {},
    );
  }

  getPortalLink(): Observable<CustomerPortalLinkResponse> {
    return this._http.post<CustomerPortalLinkResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.CUSTOMER_PORTAL_LINK}`,
      {},
    );
  }

  getMyInvoices(params: InvoiceListParams = {}): Observable<InvoiceListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<InvoiceListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_INVOICES}`,
      { params: httpParams },
    );
  }

  getMyInvoice(id: string): Observable<Invoice> {
    return this._http.get<Invoice>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_INVOICE_BY_ID(id)}`,
    );
  }

  payInvoice(id: string, consent: PayInvoiceConsent): Observable<PayInvoiceResponse> {
    return this._http.post<PayInvoiceResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_INVOICE_PAY(id)}`,
      consent,
    );
  }

  getMyInvoiceLineItems(id: string): Observable<InvoiceLineItemDetail[]> {
    return this._http.get<InvoiceLineItemDetail[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_INVOICE_LINE_ITEMS(id)}`,
    );
  }

  getMySubscriptions(
    params: SubscriptionListParams = {},
  ): Observable<SubscriptionListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<SubscriptionListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_SUBSCRIPTIONS}`,
      { params: httpParams },
    );
  }

  /**
   * Lightweight count-only lookup used by the profile tabs to decide
   * which tabs to render and what badge values to show. Never loads
   * the full lists — one call returns all counts.
   */
  getMyCounts(): Observable<MyBillingCounts> {
    return this._http.get<MyBillingCounts>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_COUNTS}`,
    );
  }
}
