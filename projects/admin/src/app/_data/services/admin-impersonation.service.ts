import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'core';
import { ImpersonateResponse } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminImpersonationService {
  private readonly _http = inject(HttpClient);

  /**
   * Mint a short-lived impersonation token for `userId`. The returned
   * access token is handed off to the main `web` app via its `/impersonate`
   * route (opened in a new tab) — never stored in the admin app's own
   * session.
   */
  impersonate(userId: string, reason: string): Observable<ImpersonateResponse> {
    return this._http.post<ImpersonateResponse>(
      `${environment.apiUrl}/admin/impersonate/${userId}`,
      { reason },
    );
  }
}
