import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type {
  AssignProgramPayload,
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  UpdateAssignmentPayload,
} from '../../models/workout/assignment.model';

/**
 * ProgramAssignmentService — REST wrapper over /program-assignments
 * (instructor surface) and /my/program-assignments (client surface).
 *
 * `assign()` is the headliner — the BE runs the copy-on-assign deep
 * tree clone atomically and fires PROGRAM_ASSIGNED to the client.
 */
@Injectable({ providedIn: 'root' })
export class ProgramAssignmentService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BASE}`;
  private readonly _myBase = `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.MY}`;

  // ── Instructor surface ───────────────────────────────────────────

  assign(payload: AssignProgramPayload): Observable<ProgramAssignment> {
    return this._http.post<ProgramAssignment>(this._base, payload);
  }

  listForInstructor(
    query: ListAssignmentsQuery = {},
  ): Observable<PaginatedAssignments> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.status) p = p.set('status', query.status);
    if (query.clientId) p = p.set('clientId', query.clientId);
    return this._http.get<PaginatedAssignments>(this._base, { params: p });
  }

  update(
    id: string,
    payload: UpdateAssignmentPayload,
  ): Observable<ProgramAssignment> {
    return this._http.patch<ProgramAssignment>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BY_ID(id)}`,
      payload,
    );
  }

  remove(id: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BY_ID(id)}`,
    );
  }

  // ── Client surface ───────────────────────────────────────────────

  listForClient(
    query: ListAssignmentsQuery = {},
  ): Observable<PaginatedAssignments> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.status) p = p.set('status', query.status);
    return this._http.get<PaginatedAssignments>(this._myBase, { params: p });
  }

  // ── Shared ───────────────────────────────────────────────────────

  /** Detail accessible to either party (instructor OR client). */
  get(id: string): Observable<ProgramAssignment> {
    return this._http.get<ProgramAssignment>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BY_ID(id)}`,
    );
  }

  /**
   * Client manually skips an assigned workout. Locked V1 decision —
   * skip is both auto-derived (passed date, no log) and manual.
   * Returns the updated assigned-workout so the FE can optimistically
   * patch its tree.
   */
  skipAssignedWorkout(assignedWorkoutId: string): Observable<{ id: string; status: string }> {
    return this._http.post<{ id: string; status: string }>(
      `${environment.apiUrl}/my/assigned-workouts/${assignedWorkoutId}/skip`,
      {},
    );
  }
}
