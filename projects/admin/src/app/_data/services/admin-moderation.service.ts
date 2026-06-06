import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import { DbRow } from '../models/admin.models';

/**
 * Moderation API: messaging (reports/velocity/suspend — SUPER_ADMIN/
 * SUPPORT) + content (posts/reviews — ADMIN+) + feedback/waitlist
 * (existing ADMIN+ endpoints).
 */
@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private readonly _http = inject(HttpClient);
  private readonly _api = environment.apiUrl;

  private page(page: number, limit: number, extra?: Record<string, string>) {
    let p = new HttpParams().set('page', String(page)).set('limit', String(limit));
    for (const [k, v] of Object.entries(extra ?? {})) if (v) p = p.set(k, v);
    return p;
  }

  // ── Messaging ──
  reports(page: number, limit: number, status?: string): Observable<PaginatedResponse<DbRow>> {
    return this._http.get<PaginatedResponse<DbRow>>(`${this._api}/admin/messaging/reports`, {
      params: this.page(page, limit, status ? { status } : undefined),
    });
  }
  resolveReport(id: string, status: string, resolutionNotes?: string): Observable<DbRow> {
    return this._http.patch<DbRow>(`${this._api}/admin/messaging/reports/${id}`, {
      status,
      resolutionNotes,
    });
  }
  suspendUser(userId: string, reason: string): Observable<DbRow> {
    return this._http.post<DbRow>(`${this._api}/admin/messaging/suspensions`, {
      userId,
      reason,
    });
  }
  velocityAlarms(page: number, limit: number, includeReviewed = false): Observable<PaginatedResponse<DbRow>> {
    return this._http.get<PaginatedResponse<DbRow>>(`${this._api}/admin/messaging/velocity-alarms`, {
      params: this.page(page, limit, { includeReviewed: String(includeReviewed) }),
    });
  }
  reviewAlarm(id: string): Observable<DbRow> {
    return this._http.patch<DbRow>(`${this._api}/admin/messaging/velocity-alarms/${id}/review`, {});
  }

  // ── Content ──
  posts(page: number, limit: number): Observable<PaginatedResponse<DbRow>> {
    return this._http.get<PaginatedResponse<DbRow>>(`${this._api}/admin/content/posts`, {
      params: this.page(page, limit),
    });
  }
  deletePost(id: string): Observable<DbRow> {
    return this._http.delete<DbRow>(`${this._api}/admin/content/posts/${id}`);
  }
  reviews(page: number, limit: number): Observable<PaginatedResponse<DbRow>> {
    return this._http.get<PaginatedResponse<DbRow>>(`${this._api}/admin/content/reviews`, {
      params: this.page(page, limit),
    });
  }
  deleteReview(id: string): Observable<DbRow> {
    return this._http.delete<DbRow>(`${this._api}/admin/content/reviews/${id}`);
  }

  // ── Feedback / Waitlist (existing endpoints; may return array) ──
  feedback(): Observable<DbRow[]> {
    return this._http.get<DbRow[]>(`${this._api}/feedback`);
  }
  waitlist(): Observable<DbRow[]> {
    return this._http.get<DbRow[]>(`${this._api}/waitlist`);
  }
}
