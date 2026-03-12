import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ClientListResponse,
  ClientListParams,
  InstructorClient,
  ClientRequest,
  CreateClientInvitation,
  UpdateClientPayload,
} from '../../models/client/client.model';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.BASE}`;

  getClients(params: ClientListParams = {}): Observable<ClientListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());

    return this._http.get<ClientListResponse>(this.baseUrl, { params: httpParams });
  }

  getMyInstructors(): Observable<InstructorClient[]> {
    return this._http.get<InstructorClient[]>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.MY_INSTRUCTORS}`,
    );
  }

  getPendingRequests(): Observable<ClientRequest[]> {
    return this._http.get<ClientRequest[]>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.PENDING_REQUESTS}`,
    );
  }

  sendInvitation(dto: CreateClientInvitation): Observable<{ message: string; request: ClientRequest }> {
    return this._http.post<{ message: string; request: ClientRequest }>(
      `${environment.apiUrl}${API_ENDPOINTS.CLIENTS.INVITE}`,
      dto,
    );
  }

  requestToBeClient(instructorId: string, message?: string): Observable<{ message: string; request: ClientRequest }> {
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
}
