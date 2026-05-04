import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import {
  CreateGroupPayload,
  DecideJoinRequestPayload,
  DiscoverGroupListResponse,
  DiscoverGroupsQuery,
  Group,
  GroupJoinRequest,
  GroupJoinRequestListResponse,
  GroupMember,
  GroupMemberListResponse,
  SelfJoinResult,
  UpdateGroupPayload,
  UpdateMemberRolePayload,
} from '../../models/group/group.model';

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

  addMembersBulk(groupId: string, userIds: string[]): Observable<GroupMember[]> {
    return this._http.post<GroupMember[]>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.BULK_MEMBERS(groupId)}`,
      { userIds },
    );
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}/members/${userId}`);
  }

  leaveGroup(groupId: string): Observable<void> {
    return this._http.delete<void>(`${this.baseUrl}/${groupId}/members/me`);
  }

  /**
   * Self-join a public group.
   *
   * Server branches on `joinPolicy`:
   * - OPEN     → returns `{ status: 'JOINED', member }`.
   * - APPROVAL → returns `{ status: 'PENDING', request }`. The owner
   *              must approve or reject before the user is a member.
   * - INVITE_ONLY → 403.
   */
  selfJoin(groupId: string): Observable<SelfJoinResult> {
    return this._http.post<SelfJoinResult>(
      `${this.baseUrl}/${groupId}/join`,
      {},
    );
  }

  /**
   * Discover public groups. When authenticated, the server excludes
   * groups the user already belongs to and enriches each row with
   * `myJoinRequestStatus`.
   */
  discoverGroups(
    query: DiscoverGroupsQuery = {},
  ): Observable<DiscoverGroupListResponse> {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.city) params = params.set('city', query.city);
    if (query.country) params = params.set('country', query.country);
    if (query.page !== undefined) params = params.set('page', query.page.toString());
    if (query.limit !== undefined) params = params.set('limit', query.limit.toString());
    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        params = params.append('tags', tag);
      }
    }
    return this._http.get<DiscoverGroupListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.DISCOVER}`,
      { params },
    );
  }

  /** List pending join requests for a group (owner only). */
  listJoinRequests(
    groupId: string,
    page = 1,
    limit = 20,
  ): Observable<GroupJoinRequestListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this._http.get<GroupJoinRequestListResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.JOIN_REQUESTS(groupId)}`,
      { params },
    );
  }

  /** Approve or reject a pending join request (owner only). */
  decideJoinRequest(
    groupId: string,
    requestId: string,
    payload: DecideJoinRequestPayload,
  ): Observable<GroupJoinRequest> {
    return this._http.patch<GroupJoinRequest>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.JOIN_REQUEST_BY_ID(groupId, requestId)}`,
      payload,
    );
  }

  /**
   * Current user's pending join request for a group, or null. Used by
   * Discover to render "Request pending" instead of "Request to join".
   */
  getMyJoinRequest(
    groupId: string,
  ): Observable<{ request: GroupJoinRequest | null }> {
    return this._http.get<{ request: GroupJoinRequest | null }>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.MY_JOIN_REQUEST(groupId)}`,
    );
  }

  /** Cancel my own pending request. Idempotent on the server. */
  cancelMyJoinRequest(groupId: string): Observable<{ message: string }> {
    return this._http.delete<{ message: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.MY_JOIN_REQUEST(groupId)}`,
    );
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

  updateMemberRole(
    groupId: string,
    userId: string,
    payload: UpdateMemberRolePayload,
  ): Observable<GroupMember> {
    return this._http.patch<GroupMember>(
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.MEMBER_ROLE(groupId, userId)}`,
      payload,
    );
  }
}
