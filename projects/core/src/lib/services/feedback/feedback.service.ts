import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { FeedbackPayload } from '../../models/feedback/feedback.model';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.FEEDBACK.BASE}`;

  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  submit(payload: FeedbackPayload): Observable<void> {
    return this._http.post<void>(this._base, payload);
  }
}
