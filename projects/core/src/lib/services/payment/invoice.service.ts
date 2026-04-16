import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  CreateInvoicePayload,
  Invoice,
  InvoiceLineItemDetail,
  InvoiceListParams,
  InvoiceListResponse,
} from '../../models/payment/invoice.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICES}`;

  list(params: InvoiceListParams = {}): Observable<InvoiceListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.clientId) httpParams = httpParams.set('clientId', params.clientId);
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<InvoiceListResponse>(this.baseUrl, { params: httpParams });
  }

  get(id: string): Observable<Invoice> {
    return this._http.get<Invoice>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICE_BY_ID(id)}`,
    );
  }

  create(payload: CreateInvoicePayload): Observable<Invoice> {
    return this._http.post<Invoice>(this.baseUrl, payload);
  }

  send(id: string): Observable<Invoice> {
    return this._http.post<Invoice>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICE_SEND(id)}`,
      {},
    );
  }

  void(id: string): Observable<Invoice> {
    return this._http.post<Invoice>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICE_VOID(id)}`,
      {},
    );
  }

  markPaid(id: string): Observable<Invoice> {
    return this._http.post<Invoice>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICE_MARK_PAID(id)}`,
      {},
    );
  }

  getLineItems(id: string): Observable<InvoiceLineItemDetail[]> {
    return this._http.get<InvoiceLineItemDetail[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.INVOICE_LINE_ITEMS(id)}`,
    );
  }
}
