import { Injectable, LOCALE_ID, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { languageOfLocale } from '../../constants/languages.const';
import { FeedbackPayload } from '../../models/feedback/feedback.model';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly _http = inject(HttpClient);
  private readonly _language = languageOfLocale(inject(LOCALE_ID));
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.FEEDBACK.BASE}`;

  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  submit(payload: FeedbackPayload): Observable<void> {
    // The API writes the confirmation email in the language of this page.
    return this._http.post<void>(this._base, { ...payload, language: this._language });
  }
}
