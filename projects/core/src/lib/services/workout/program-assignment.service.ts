import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import type {
  AssignProgramPayload,
  ListAssignmentsQuery,
  PaginatedAssignments,
  ProgramAssignment,
  UpdateAssignmentPayload,
} from '../../models/workout/assignment.model';
import type {
  ScheduleRoutinePayload,
  TrainingDay,
} from '../../models/workout/training-day.model';

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

  /**
   * `silent` opts the read out of the global error dialog, for a screen that
   * shows its own failure or empty state (Home's Needs you).
   */
  listForInstructor(
    query: ListAssignmentsQuery = {},
    opts?: { silent?: boolean },
  ): Observable<PaginatedAssignments> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.status) p = p.set('status', query.status);
    if (query.clientId) p = p.set('clientId', query.clientId);
    if (query.search?.trim()) p = p.set('search', query.search.trim());
    return this._http.get<PaginatedAssignments>(this._base, {
      params: p,
      ...(opts?.silent ? { context: silentRequest() } : {}),
    });
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
    if (query.search?.trim()) p = p.set('search', query.search.trim());
    return this._http.get<PaginatedAssignments>(this._myBase, { params: p });
  }

  // ── Shared ───────────────────────────────────────────────────────

  /**
   * Detail accessible to either party (instructor OR client). `silent` as
   * on `listForInstructor`, for a read whose failure only leaves a detail
   * out (the coach's hive sheet: the planned days of a client's week).
   */
  get(id: string, opts?: { silent?: boolean }): Observable<ProgramAssignment> {
    return this._http.get<ProgramAssignment>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BY_ID(id)}`,
      opts?.silent ? { context: silentRequest() } : {},
    );
  }

  /**
   * Client manually skips an assigned workout. Locked V1 decision —
   * skip is both auto-derived (passed date, no log) and manual.
   * Returns the updated assigned-workout so the FE can optimistically
   * patch its tree.
   */
  /**
   * Today, this week, and every active plan in one read. Powers the
   * Workouts front door.
   *
   * `date` is the caller's calendar date, because "today" belongs to
   * the person training, not the server. `silent` as on `listForInstructor`.
   */
  trainingDay(date?: string, opts?: { silent?: boolean }): Observable<TrainingDay> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this._http.get<TrainingDay>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.MY_TODAY}`,
      { params, ...(opts?.silent ? { context: silentRequest() } : {}) },
    );
  }

  /**
   * Schedule one of your own routines across the week. Self-assignment,
   * so it lands in the same place a coach's plan would and shows up on
   * the Workouts front door alongside it.
   */
  scheduleRoutine(payload: ScheduleRoutinePayload): Observable<ProgramAssignment> {
    return this._http.post<ProgramAssignment>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.MY_SCHEDULED_ROUTINES}`,
      payload,
    );
  }

  skipAssignedWorkout(assignedWorkoutId: string): Observable<{ id: string; status: string }> {
    return this._http.post<{ id: string; status: string }>(
      `${environment.apiUrl}/my/assigned-workouts/${assignedWorkoutId}/skip`,
      {},
    );
  }
}
