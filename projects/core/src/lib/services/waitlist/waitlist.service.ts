import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { WaitlistPayload } from '../../models/waitlist/waitlist.model';

@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.WAITLIST.BASE}`;

  readonly isOpen = signal(false);
  readonly source = signal<string | undefined>(undefined);

  open(source?: string): void {
    this.source.set(source);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  join(payload: WaitlistPayload): Observable<void> {
    return this._http.post<void>(this._base, payload);
  }
}
