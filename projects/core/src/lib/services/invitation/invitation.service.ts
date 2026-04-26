import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';

export interface SendFriendInvitePayload {
  /** Friend's email — required for the email-send path. */
  email: string;
  /** Optional personal message included in the email body. */
  personalMessage?: string;
}

export interface SuggestInstructorByEmailPayload {
  /** Coach's name. */
  coachName: string;
  /** Coach's email. */
  email: string;
  /** Optional note from the recommender. */
  note?: string;
}

/**
 * Invitation emails — friend-invite and instructor-suggestion.
 *
 * The endpoints do NOT exist on the API yet. They will land alongside
 * the jobs/notifications module (see api docs/research/jobs-system).
 * Until then, callers should treat the failure case as "fall back to
 * copy-the-link" so the UX still works end-to-end.
 *
 * When the backend ships these endpoints:
 *   - keep the request bodies as-is (the BE owns rendering the email
 *     template and queueing the send);
 *   - if rate-limiting / abuse protection is needed, add it server-side
 *     not here.
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly _http = inject(HttpClient);
  private readonly _base = environment.apiUrl;

  sendFriendInvite(payload: SendFriendInvitePayload): Observable<void> {
    return this._http.post<void>(
      `${this._base}${API_ENDPOINTS.INVITATIONS.FRIEND_EMAIL}`,
      payload,
    );
  }

  suggestInstructorByEmail(payload: SuggestInstructorByEmailPayload): Observable<void> {
    return this._http.post<void>(
      `${this._base}${API_ENDPOINTS.INVITATIONS.INSTRUCTOR_EMAIL}`,
      payload,
    );
  }
}
