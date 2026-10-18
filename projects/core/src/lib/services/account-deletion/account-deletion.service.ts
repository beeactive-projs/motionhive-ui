import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { silentRequest } from '../../interceptors/silent-request.context';
import { AccountDeletionPreview } from '../../models/account/account-deletion.model';

/**
 * Deleting your own account: what it would end, the emailed code, and the
 * confirmation. Every call is silent: the deletion screen shows its own
 * errors in place, where the person is, instead of a dialog over it.
 *
 * Keeping the account during the cooling-off is `AuthService.restoreAccount`,
 * since it signs the person back in.
 */
@Injectable({ providedIn: 'root' })
export class AccountDeletionService {
  private readonly _http = inject(HttpClient);
  private readonly _base = environment.apiUrl;

  preview(): Observable<AccountDeletionPreview> {
    return this._http.get<AccountDeletionPreview>(
      `${this._base}${API_ENDPOINTS.ACCOUNT_DELETION.PREVIEW}`,
      { context: silentRequest() },
    );
  }

  /** Emails a 6-digit code; a second call replaces the first code. */
  sendCode(): Observable<{ sentTo: string }> {
    return this._http.post<{ sentTo: string }>(
      `${this._base}${API_ENDPOINTS.ACCOUNT_DELETION.CODE}`,
      {},
      { context: silentRequest() },
    );
  }

  /**
   * Deactivates the account, ends what it shares with other people and
   * schedules the erasure. The session is revoked server-side, so the caller
   * ends it locally with `AuthService.endLocalSession`.
   */
  confirm(code: string): Observable<{ scheduledFor: string }> {
    return this._http.post<{ scheduledFor: string }>(
      `${this._base}${API_ENDPOINTS.ACCOUNT_DELETION.CONFIRM}`,
      { code },
      { context: silentRequest() },
    );
  }
}
