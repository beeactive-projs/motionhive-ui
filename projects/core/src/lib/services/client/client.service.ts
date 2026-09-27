import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
// Type-only: PrimeNG is a `web` dependency and must not become a resolver
// edge in the mobile build, which imports this same service.
import type { TableLazyLoadEvent } from 'primeng/table';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  ClientListParams,
  ClientListResponse,
  ClientRequest,
  CreateClientInvitation,
  InstructorClient,
  InvitationDetails,
  UpdateClientPayload,
} from '../../models/client/client.model';
import { InstructorListResponse } from '../../models/client/instructor.model';
import { silentRequest } from '../../interceptors/silent-request.context';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.BASE}`;

  /**
   * `silent` opts the call out of the global error dialog, for screens that
   * report a failed load themselves. A list that refreshes on every entry
   * cannot also raise a blocking alert on every failed entry.
   */
  getClients(
    params: ClientListParams = {},
    opts?: { silent?: boolean },
  ): Observable<ClientListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.direction) httpParams = httpParams.set('direction', params.direction);

    // Sent trimmed, and only when it can match: the API ignores anything
    // under `MIN_SEARCH_LENGTH` characters, and an empty `search=` would be
    // noise on the URL. Callers are expected to hold a shorter term back
    // rather than send one the API will quietly ignore.
    const search = params.search?.trim();
    if (search) httpParams = httpParams.set('search', search);

    return this._http.get<ClientListResponse>(this.baseUrl, {
      params: httpParams,
      ...(opts?.silent ? { context: silentRequest() } : {}),
    });
  }

  /**
   * One client, in the same shape as a row from `getClients`. Keyed on
   * the client's user id, so a profile URL survives a refresh or a link
   * shared from the roster.
   */
  getClient(clientId: string): Observable<InstructorClient> {
    return this._http.get<InstructorClient>(`${this.baseUrl}/${clientId}`);
  }

  filterClients(event: TableLazyLoadEvent): Observable<ClientListResponse> {
    return this._http.post<ClientListResponse>(`${this.baseUrl}/filter`, event, {
      context: silentRequest(),
    });
  }

  filterPendingRequests(event: TableLazyLoadEvent): Observable<ClientListResponse> {
    return this._http.post<ClientListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.FILTER_REQUESTS}`,
      event,
    );
  }

  getMyInstructors(): Observable<InstructorListResponse> {
    return this._http.get<InstructorListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.MY_INSTRUCTORS}`,
    );
  }

  leaveInstructor(instructorId: string): Observable<InstructorClient> {
    return this._http.delete<InstructorClient>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.LEAVE_INSTRUCTOR(instructorId)}`,
    );
  }

  getPendingRequests(): Observable<ClientRequest[]> {
    return this._http.get<ClientRequest[]>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.PENDING_REQUESTS}`,
    );
  }

  /**
   * Feeds a dot and a badge, never layout. Silent because nobody asked for
   * it: it rides along with every entry into the coach's tabs, and a failed
   * count is not worth a modal over whatever the screen did manage to load.
   */
  getPendingRequestsCount(): Observable<{ count: number }> {
    return this._http.get<{ count: number }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.PENDING_REQUESTS_COUNT}`,
      { context: silentRequest() },
    );
  }

  getSentInvites(): Observable<ClientRequest[]> {
    return this._http.get<ClientRequest[]>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.SENT_INVITES}`,
    );
  }

  sendInvitation(
    dto: CreateClientInvitation,
  ): Observable<{ message: string; request: ClientRequest }> {
    return this._http.post<{ message: string; request: ClientRequest }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.INVITE}`,
      dto,
    );
  }

  resendInvitation(requestId: string): Observable<{ message: string; request: ClientRequest }> {
    return this._http.post<{ message: string; request: ClientRequest }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.INVITE}/${requestId}/resend`,
      null,
    );
  }

  getInvitationByToken(token: string): Observable<InvitationDetails> {
    return this._http.get<InvitationDetails>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.INVITE_BY_TOKEN(token)}`,
    );
  }

  acceptByToken(token: string): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.ACCEPT_BY_TOKEN}`,
      { token },
    );
  }

  requestToBeClient(
    instructorId: string,
    message?: string,
  ): Observable<{ message: string; request: ClientRequest }> {
    return this._http.post<{ message: string; request: ClientRequest }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.REQUEST}/${instructorId}`,
      { message },
    );
  }

  acceptRequest(requestId: string): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.REQUESTS}/${requestId}/accept`,
      {},
    );
  }

  declineRequest(requestId: string): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.REQUESTS}/${requestId}/decline`,
      {},
    );
  }

  cancelRequest(requestId: string): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.REQUESTS}/${requestId}/cancel`,
      {},
    );
  }

  updateClient(clientId: string, dto: UpdateClientPayload): Observable<InstructorClient> {
    return this._http.patch<InstructorClient>(`${this.baseUrl}/${clientId}`, dto);
  }

  archiveClient(clientId: string): Observable<InstructorClient> {
    return this._http.delete<InstructorClient>(`${this.baseUrl}/${clientId}`);
  }

  unarchiveClient(clientId: string): Observable<InstructorClient> {
    return this._http.patch<InstructorClient>(`${this.baseUrl}/${clientId}`, { status: 'ACTIVE' });
  }
}
