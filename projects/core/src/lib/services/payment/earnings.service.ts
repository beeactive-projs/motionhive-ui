import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import { EarningsSummary } from '../../models/payment/earnings.model';
import {
  PaymentListParams,
  PaymentListResponse,
} from '../../models/payment/payment.model';

@Injectable({ providedIn: 'root' })
export class EarningsService {
  private readonly _http = inject(HttpClient);

  /**
   * `silent` opts the read out of the global error dialog, for a caller that
   * only feeds a badge with it (the Menu's overdue dot).
   */
  getSummary(opts?: { silent?: boolean }): Observable<EarningsSummary> {
    return this._http.get<EarningsSummary>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.EARNINGS}`,
      opts?.silent ? { context: silentRequest() } : {},
    );
  }

  getPayments(params: PaymentListParams = {}): Observable<PaymentListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.clientId) httpParams = httpParams.set('clientId', params.clientId);
    // The only route from an invoice to something refundable.
    if (params.invoiceId) httpParams = httpParams.set('invoiceId', params.invoiceId);
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this._http.get<PaymentListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PAYMENTS_LIST}`,
      { params: httpParams },
    );
  }
}
