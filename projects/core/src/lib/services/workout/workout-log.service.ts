import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type {
  CompleteWorkoutPayload,
  LoggedExercise,
  LogSetPayload,
  LoggedSet,
  StartWorkoutPayload,
  WorkoutLog,
} from '../../models/workout/log.model';
import type { Routine } from '../../models/workout/routine.model';

export interface PaginatedWorkoutLogs {
  items: WorkoutLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListWorkoutLogsQuery {
  page?: number;
  limit?: number;
  /** Inclusive lower bound on startedAt. */
  dateFrom?: string;
  /** Exclusive upper bound on startedAt. */
  dateTo?: string;
  /** Case-insensitive match on the session name. */
  search?: string;
}

/**
 * Client workout-log lifecycle: start → log set → complete. The BE
 * hydrates the log tree from the assignment on start, so the FE only
 * needs to PATCH individual sets as the client works through them.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutLogService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BASE}`;

  start(payload: StartWorkoutPayload): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(this._base, payload);
  }

  get(id: string): Observable<WorkoutLog> {
    return this._http.get<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BY_ID(id)}`,
    );
  }

  logSet(
    workoutLogId: string,
    setId: string,
    payload: LogSetPayload,
  ): Observable<LoggedSet> {
    return this._http.patch<LoggedSet>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.LOG_SET(workoutLogId, setId)}`,
      payload,
    );
  }

  /**
   * Cancel a workout in progress: the log and everything logged in it
   * are deleted. Not the same as skipping, which records a decision.
   */
  discard(id: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BY_ID(id)}`,
    );
  }

  complete(
    id: string,
    payload: CompleteWorkoutPayload = {},
  ): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COMPLETE(id)}`,
      payload,
    );
  }

  /**
   * History — completed workout logs for the signed-in user, newest
   * first. BE eager-loads the assignment + lightweight set list so the
   * row metric "18 sets" computes client-side without a follow-up hit.
   */
  list(query: ListWorkoutLogsQuery = {}): Observable<PaginatedWorkoutLogs> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.dateFrom) p = p.set('dateFrom', query.dateFrom);
    if (query.dateTo) p = p.set('dateTo', query.dateTo);
    if (query.search?.trim()) p = p.set('search', query.search.trim());
    return this._http.get<PaginatedWorkoutLogs>(this._base, { params: p });
  }

  /**
   * Coach-side read: a specific client's workout history. BE 404s when
   * the caller isn't an ACTIVE coach of that client, so no extra
   * permission gating is needed here.
   */
  listForClient(
    clientId: string,
    query: ListWorkoutLogsQuery = {},
  ): Observable<PaginatedWorkoutLogs> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    return this._http.get<PaginatedWorkoutLogs>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COACH_LIST_FOR_CLIENT(clientId)}`,
      { params: p },
    );
  }

  /** Coach-side single-log read. Same gating as listForClient. */
  getForCoach(id: string): Observable<WorkoutLog> {
    return this._http.get<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COACH_BY_ID(id)}`,
    );
  }

  /** Look up the log produced by a given assigned workout. 404s if
   *  the workout was never started — caller should fall back to a
   *  "nothing to view" message. */
  getByAssignedWorkout(assignedWorkoutId: string): Observable<WorkoutLog> {
    return this._http.get<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BY_ASSIGNED_WORKOUT(assignedWorkoutId)}`,
    );
  }

  /** Most-recent IN_PROGRESS workout for the signed-in user (or null
   *  if there's nothing to resume). 200 with null body — no 404. */
  getInProgress(): Observable<WorkoutLog | null> {
    return this._http.get<WorkoutLog | null>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.IN_PROGRESS}`,
    );
  }

  // ── Mid-session mutations (freestyle + S14 affordances) ──────────

  addExercise(
    workoutLogId: string,
    exerciseId: string,
  ): Observable<LoggedExercise> {
    return this._http.post<LoggedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.ADD_EXERCISE(workoutLogId)}`,
      { exerciseId },
    );
  }

  removeExercise(
    workoutLogId: string,
    loggedExerciseId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.REMOVE_EXERCISE(workoutLogId, loggedExerciseId)}`,
    );
  }

  /**
   * Turn a finished workout into a repeatable routine. TARGETS bakes
   * what was actually lifted into next time's targets; STRUCTURE keeps
   * the exercises and set counts and drops the loads.
   */
  saveAsRoutine(
    workoutLogId: string,
    payload: { name: string; folder?: string; mode?: 'TARGETS' | 'STRUCTURE' },
  ): Observable<Routine> {
    return this._http.post<Routine>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.SAVE_AS_ROUTINE(workoutLogId)}`,
      payload,
    );
  }

  /**
   * Skip an exercise, or undo it. Distinct from removing: a skipped row
   * stays so the coach can tell it apart from one that was never there.
   * Pass `false` to undo, which is what the undo strip does.
   */
  setExerciseSkipped(
    workoutLogId: string,
    loggedExerciseId: string,
    skipped: boolean,
  ): Observable<LoggedExercise> {
    return this._http.patch<LoggedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.SKIP_EXERCISE(workoutLogId, loggedExerciseId)}`,
      { skipped },
    );
  }

  /**
   * Substitute a different movement mid-session. Set rows and anything
   * already logged into them survive; the swap is recorded so the coach
   * sees the substitution rather than an unexplained change.
   */
  swapExercise(
    workoutLogId: string,
    loggedExerciseId: string,
    exerciseId: string,
  ): Observable<LoggedExercise> {
    return this._http.patch<LoggedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.SWAP_EXERCISE(workoutLogId, loggedExerciseId)}`,
      { exerciseId },
    );
  }

  addSet(
    workoutLogId: string,
    loggedExerciseId: string,
    payload: { setType?: string } = {},
  ): Observable<LoggedSet> {
    return this._http.post<LoggedSet>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.ADD_SET(workoutLogId, loggedExerciseId)}`,
      payload,
    );
  }

  /**
   * "Last time you did this" — most-recent completed log's actuals for
   * a catalog exercise. Returns up to 6 sets (one workout's worth).
   * Powers the `LastTimeHint` component on the active log.
   */
  lastForExercise(exerciseId: string): Observable<LoggedSet[]> {
    return this._http.get<LoggedSet[]>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.LAST_FOR_EXERCISE(exerciseId)}`,
    );
  }
}
