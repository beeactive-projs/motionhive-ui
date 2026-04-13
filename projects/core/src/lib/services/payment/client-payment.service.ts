import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  Invoice,
  InvoiceListParams,
  InvoiceListResponse,
  PayInvoiceConsent,
  PayInvoiceResponse,
} from '../../models/payment/invoice.model';
import {
  PaymentListParams,
  PaymentListResponse,
} from '../../models/payment/payment.model';
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
    return this._http.get<CustomerPortalLinkResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.CUSTOMER_PORTAL_LINK}`,
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

  getMyPaymentHistory(params: PaymentListParams = {}): Observable<PaymentListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<PaymentListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_PAYMENT_HISTORY}`,
      { params: httpParams },
    );
  }
}
