import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Group,
  GroupMember,
  GroupListResponse,
  GroupMemberListResponse,
  CreateGroupPayload,
  UpdateGroupPayload,
} from '../../models/group/group.model';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.GROUPS.BASE}`;

  getMyGroups(): Observable<Group[]> {
    return this._http.get<Group[]>(this.baseUrl);
  }

  getInstructorsGroups(): Observable<Group[]> {
    return this._http.get<Group[]>(this.baseUrl + '/instructor');
  }

  getById(groupId: string): Observable<Group> {
    return this._http.get<Group>(`${this.baseUrl}/${groupId}`);
  }

  create(payload: CreateGroupPayload): Observable<Group> {
    return this._http.post<Group>(this.baseUrl, payload);
  }

  update(groupId: string, payload: UpdateGroupPayload): Observable<Group> {
    return this._http.patch<Group>(`${this.baseUrl}/${groupId}`, payload);
  }

  delete(groupId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}`);
  }

  getMembers(groupId: string, page = 1, limit = 20): Observable<GroupMemberListResponse> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this._http.get<GroupMemberListResponse>(`${this.baseUrl}/${groupId}/members`, {
      params,
    });
  }

  addMember(groupId: string, userId: string): Observable<GroupMember> {
    return this._http.post<GroupMember>(`${this.baseUrl}/${groupId}/members`, { userId });
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}/members/${userId}`);
  }

  leaveGroup(groupId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}/members/me`);
  }

  selfJoin(groupId: string): Observable<GroupMember> {
    return this._http.post<GroupMember>(`${this.baseUrl}/${groupId}/join`, {});
  }

  generateJoinLink(
    groupId: string,
  ): Observable<{ message: string; token: string; expiresAt: string }> {
    return this._http.post<{ message: string; token: string; expiresAt: string }>(
      `${this.baseUrl}/${groupId}/join-link`,
      {},
    );
  }

  revokeJoinLink(groupId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}/join-link`);
  }

  joinViaLink(token: string): Observable<GroupMember> {
    return this._http.post<GroupMember>(`${this.baseUrl}/join/${token}`, {});
  }
}
