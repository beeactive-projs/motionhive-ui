import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { CreateRefundPayload, Refund } from '../../models/payment/payment.model';

@Injectable({ providedIn: 'root' })
export class RefundService {
  private readonly _http = inject(HttpClient);

  create(payload: CreateRefundPayload): Observable<Refund> {
    return this._http.post<Refund>(
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.REFUNDS}`,
      payload,
    );
  }
}
