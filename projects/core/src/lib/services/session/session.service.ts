import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import type { PaginatedResponse } from '../../models/common/pagination.model';
import type {
  BlockedSessionInstance,
  BookRequest,
  BookResponse,
  CancelBookingRequest,
  CancelBookingResponse,
  CancelInstanceRequest,
  CancelInstanceResponse,
  CreateTemplateRequest,
  CreateTemplateResponse,
  DeclineParticipantRequest,
  DiscoverQuery,
  FollowUpRequest,
  FollowUpResponse,
  JoinInfo,
  ListInstancesQuery,
  ListParticipantsQuery,
  ListTemplatesQuery,
  MyCounts,
  MyQuery,
  PatchInstanceRequest,
  PatchParticipantRequest,
  PreviewRecurrenceRequest,
  PreviewRecurrenceResponse,
  PublicSessionInstance,
  RegenerateRequest,
  RegenerateResponse,
  RescheduleInstanceRequest,
  RescheduleInstanceResponse,
  SessionInstance,
  SessionParticipant,
  SessionTemplate,
  UpdateTemplateRequest,
} from '../../models/session/session.model';

/**
 * Sessions HTTP service.
 *
 * One method per backend endpoint (24 methods covering Phases A–G of
 * `SESSIONS_MASTER_BUILD_PLAN.md`). Observable-based, matches the
 * existing `GroupService` pattern — no signals here; stores convert
 * to signals when needed.
 *
 * Strict types only: no `any`, no `unknown` leaking to callers.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _http = inject(HttpClient);
  private readonly _base = environment.apiUrl;

  // ─── Templates (instructor) ────────────────────────────────────────

  previewRecurrence(
    body: PreviewRecurrenceRequest,
  ): Observable<PreviewRecurrenceResponse> {
    return this._http.post<PreviewRecurrenceResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.PREVIEW_RECURRENCE}`,
      body,
    );
  }

  createTemplate(
    body: CreateTemplateRequest,
  ): Observable<CreateTemplateResponse> {
    return this._http.post<CreateTemplateResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.TEMPLATES}`,
      body,
    );
  }

  listTemplates(
    query: ListTemplatesQuery = {},
  ): Observable<PaginatedResponse<SessionTemplate>> {
    return this._http.get<PaginatedResponse<SessionTemplate>>(
      `${this._base}${API_ENDPOINTS.SESSIONS.TEMPLATES}`,
      { params: this._toParams(query) },
    );
  }

  getTemplate(id: string): Observable<SessionTemplate> {
    return this._http.get<SessionTemplate>(
      `${this._base}${API_ENDPOINTS.SESSIONS.TEMPLATE_BY_ID(id)}`,
    );
  }

  updateTemplate(
    id: string,
    body: UpdateTemplateRequest,
  ): Observable<SessionTemplate> {
    return this._http.patch<SessionTemplate>(
      `${this._base}${API_ENDPOINTS.SESSIONS.TEMPLATE_BY_ID(id)}`,
      body,
    );
  }

  deleteTemplate(id: string): Observable<void> {
    return this._http.delete<void>(
      `${this._base}${API_ENDPOINTS.SESSIONS.TEMPLATE_BY_ID(id)}`,
    );
  }

  regenerate(id: string, body: RegenerateRequest): Observable<RegenerateResponse> {
    return this._http.post<RegenerateResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.REGENERATE(id)}`,
      body,
    );
  }

  // ─── Instances (read) ──────────────────────────────────────────────

  listInstances(
    query: ListInstancesQuery = {},
  ): Observable<PaginatedResponse<SessionInstance>> {
    return this._http.get<PaginatedResponse<SessionInstance>>(
      `${this._base}${API_ENDPOINTS.SESSIONS.INSTANCES}`,
      { params: this._toParams(query) },
    );
  }

  getInstance(id: string): Observable<SessionInstance> {
    return this._http.get<SessionInstance>(
      `${this._base}${API_ENDPOINTS.SESSIONS.INSTANCE_BY_ID(id)}`,
    );
  }

  listInstanceParticipants(
    instanceId: string,
    query: ListParticipantsQuery = {},
  ): Observable<PaginatedResponse<SessionParticipant>> {
    return this._http.get<PaginatedResponse<SessionParticipant>>(
      `${this._base}${API_ENDPOINTS.SESSIONS.INSTANCE_PARTICIPANTS(instanceId)}`,
      { params: this._toParams(query) },
    );
  }

  // ─── Instances (write) ─────────────────────────────────────────────

  cancelInstance(
    id: string,
    body: CancelInstanceRequest,
  ): Observable<CancelInstanceResponse> {
    return this._http.post<CancelInstanceResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.CANCEL_INSTANCE(id)}`,
      body,
    );
  }

  rescheduleInstance(
    id: string,
    body: RescheduleInstanceRequest,
  ): Observable<RescheduleInstanceResponse> {
    return this._http.post<RescheduleInstanceResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.RESCHEDULE_INSTANCE(id)}`,
      body,
    );
  }

  patchInstance(
    id: string,
    body: PatchInstanceRequest,
  ): Observable<SessionInstance> {
    return this._http.patch<SessionInstance>(
      `${this._base}${API_ENDPOINTS.SESSIONS.INSTANCE_BY_ID(id)}`,
      body,
    );
  }

  followUp(
    id: string,
    body: FollowUpRequest,
  ): Observable<FollowUpResponse> {
    return this._http.post<FollowUpResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.FOLLOW_UP(id)}`,
      body,
    );
  }

  // ─── Booking (client) ──────────────────────────────────────────────

  book(instanceId: string, body: BookRequest = {}): Observable<BookResponse> {
    return this._http.post<BookResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.BOOK(instanceId)}`,
      body,
    );
  }

  cancelBooking(
    instanceId: string,
    body: CancelBookingRequest = {},
  ): Observable<CancelBookingResponse> {
    return this._http.post<CancelBookingResponse>(
      `${this._base}${API_ENDPOINTS.SESSIONS.CANCEL_BOOKING(instanceId)}`,
      body,
    );
  }

  // ─── Instructor → participant ──────────────────────────────────────

  approveParticipant(
    instanceId: string,
    participantId: string,
  ): Observable<{ status: string }> {
    return this._http.post<{ status: string }>(
      `${this._base}${API_ENDPOINTS.SESSIONS.APPROVE_PARTICIPANT(instanceId, participantId)}`,
      {},
    );
  }

  declineParticipant(
    instanceId: string,
    participantId: string,
    body: DeclineParticipantRequest = {},
  ): Observable<{ status: 'DECLINED' }> {
    return this._http.post<{ status: 'DECLINED' }>(
      `${this._base}${API_ENDPOINTS.SESSIONS.DECLINE_PARTICIPANT(instanceId, participantId)}`,
      body,
    );
  }

  patchParticipant(
    instanceId: string,
    participantId: string,
    body: PatchParticipantRequest,
  ): Observable<SessionParticipant> {
    return this._http.patch<SessionParticipant>(
      `${this._base}${API_ENDPOINTS.SESSIONS.PARTICIPANT_BY_ID(instanceId, participantId)}`,
      body,
    );
  }

  // ─── Public surface (anonymous OK) ─────────────────────────────────

  discover(
    query: DiscoverQuery = {},
  ): Observable<PaginatedResponse<PublicSessionInstance>> {
    return this._http.get<PaginatedResponse<PublicSessionInstance>>(
      `${this._base}${API_ENDPOINTS.SESSIONS.DISCOVER}`,
      { params: this._toParams(query) },
    );
  }

  getPublicBySlug(
    instructorHandle: string,
    templateSlug: string,
    opts?: { silent?: boolean },
  ): Observable<PublicSessionInstance | BlockedSessionInstance> {
    return this._http.get<PublicSessionInstance | BlockedSessionInstance>(
      `${this._base}${API_ENDPOINTS.SESSIONS.PUBLIC_BY_SLUG(instructorHandle, templateSlug)}`,
      // Callers that resolve-then-redirect (search) handle a 404 themselves;
      // mark the request silent so the global error dialog stays quiet.
      opts?.silent ? { context: silentRequest() } : undefined,
    );
  }

  getPublicInstance(
    id: string,
  ): Observable<PublicSessionInstance | BlockedSessionInstance> {
    return this._http.get<PublicSessionInstance | BlockedSessionInstance>(
      `${this._base}${API_ENDPOINTS.SESSIONS.PUBLIC_INSTANCE(id)}`,
    );
  }

  // ─── Client utilities ──────────────────────────────────────────────

  listMy(query: MyQuery = {}): Observable<PaginatedResponse<SessionParticipant>> {
    return this._http.get<PaginatedResponse<SessionParticipant>>(
      `${this._base}${API_ENDPOINTS.SESSIONS.MY}`,
      { params: this._toParams(query) },
    );
  }

  myCounts(): Observable<MyCounts> {
    return this._http.get<MyCounts>(
      `${this._base}${API_ENDPOINTS.SESSIONS.MY_COUNTS}`,
    );
  }

  /**
   * Download the .ics calendar file for an instance.
   *
   * AUDIT FIX (Phase A Bug 7): the BE requires Authorization on this
   * endpoint, so `window.open(url)` doesn't work — the new tab has no
   * way to forward the JWT. Instead we fetch via `HttpClient` (which
   * the interceptor will Bearer-tag), then trigger a download from the
   * blob via a temporary anchor.
   *
   * Returns the parsed text payload as well, for callers that want to
   * preview before downloading (rare — most just trigger the download).
   */
  downloadIcs(instanceId: string, filename?: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      const sub = this._http
        .get(`${this._base}${API_ENDPOINTS.SESSIONS.ICS(instanceId)}`, {
          responseType: 'text',
        })
        .subscribe({
          next: (ics: string) => {
            this._triggerDownload(
              ics,
              filename ?? `session-${instanceId}.ics`,
              'text/calendar',
            );
            subscriber.next(ics);
            subscriber.complete();
          },
          error: (err) => subscriber.error(err),
        });
      return () => sub.unsubscribe();
    });
  }

  /**
   * Internal helper — turn an in-memory string into a downloaded file.
   * Lives here (not in a utils file) because it's tightly coupled with
   * the .ics flow's auth requirement.
   */
  private _triggerDownload(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  joinInfo(instanceId: string): Observable<JoinInfo> {
    return this._http.get<JoinInfo>(
      `${this._base}${API_ENDPOINTS.SESSIONS.JOIN_INFO(instanceId)}`,
    );
  }

  // ─── helpers ───────────────────────────────────────────────────────

  /**
   * Build `HttpParams` from a plain object. Skips `undefined` and
   * `null`; serialises everything else via `String(value)`. Array
   * values become repeated params (e.g. `?tags=a&tags=b`).
   *
   * Typed loosely (`object`) so each query DTO doesn't need an index
   * signature — DTOs stay strict for consumers, this helper stays
   * permissive for the internal mapping step.
   */
  private _toParams(query: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v !== undefined && v !== null) {
            params = params.append(key, String(v));
          }
        }
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
