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
  WorkoutMemory,
} from '../../models/workout/log.model';
import type { Routine } from '../../models/workout/routine.model';
import type { ProfilePrivacy } from '../../models/profile/profile.enums';

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
  /** Only workouts with a photo, or with a record. */
  has?: WorkoutLogFilter;
  /**
   * `all`: with the skipped days of your plans, as rows of status SKIPPED
   * and nothing to open. Ignored beside `has` or `search`.
   */
  kind?: 'all';
}

/** What History's filters keep. */
export type WorkoutLogFilter = 'photo' | 'record';

/**
 * Which of a client's workouts a coach reads: `all` adds the skipped days
 * of their plans (rows with status SKIPPED and nothing to open), `plan` and
 * `own` split the finished ones, `skipped` is the skips alone. Omitted,
 * the finished workouts only.
 */
export type CoachLogKind = 'all' | 'plan' | 'own' | 'skipped';

export interface CoachClientLogsQuery {
  page?: number;
  limit?: number;
  kind?: CoachLogKind;
  /** Inclusive lower bound on the day. */
  dateFrom?: string;
  /** Exclusive upper bound on the day. */
  dateTo?: string;
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

  /** Stop the workout's clock while the person is away from it. */
  pause(id: string): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.PAUSE(id)}`,
      {},
    );
  }

  /** Start the clock again. Does nothing on a workout that is running. */
  resume(id: string): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.RESUME(id)}`,
      {},
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
   * Sets the finished workout's one photo, replacing any before it. Send a
   * re-encoded JPEG: the API takes nothing else, and strips its metadata.
   */
  uploadPhoto(id: string, jpeg: Blob): Observable<{ hasPhoto: true; photoVersion: number }> {
    const form = new FormData();
    form.append('file', jpeg, 'photo.jpg');
    return this._http.post<{ hasPhoto: true; photoVersion: number }>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.PHOTO(id)}`,
      form,
    );
  }

  /**
   * The photo's bytes. There is no public link to it: the API checks who
   * is asking and streams it, so it comes as a blob, not a URL.
   */
  getPhoto(id: string, size: 'full' | 'thumb' = 'full'): Observable<Blob> {
    return this._http.get(`${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.PHOTO(id)}`, {
      responseType: 'blob',
      // A small 3:4 crop for a grid of them; the whole photo otherwise.
      params: size === 'thumb' ? { size } : {},
    });
  }

  deletePhoto(id: string): Observable<void> {
    return this._http.delete<void>(`${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.PHOTO(id)}`);
  }

  /** Who besides the owner sees this workout. Owner only. */
  setVisibility(
    id: string,
    visibility: ProfilePrivacy,
  ): Observable<{ id: string; visibility: ProfilePrivacy }> {
    return this._http.patch<{ id: string; visibility: ProfilePrivacy }>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.VISIBILITY(id)}`,
      { visibility },
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
    if (query.has) p = p.set('has', query.has);
    if (query.kind) p = p.set('kind', query.kind);
    return this._http.get<PaginatedWorkoutLogs>(this._base, { params: p });
  }

  /**
   * History's memory: a workout from a while back and how far one of its
   * lifts has come since. Null (200) when nothing has improved.
   */
  getMemory(): Observable<WorkoutMemory | null> {
    return this._http.get<WorkoutMemory | null>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.MEMORY}`,
    );
  }

  /**
   * Coach-side read: a specific client's workout history. BE 404s when
   * the caller isn't an ACTIVE coach of that client, so no extra
   * permission gating is needed here.
   */
  listForClient(
    clientId: string,
    query: CoachClientLogsQuery = {},
  ): Observable<PaginatedWorkoutLogs> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.kind) p = p.set('kind', query.kind);
    if (query.dateFrom) p = p.set('dateFrom', query.dateFrom);
    if (query.dateTo) p = p.set('dateTo', query.dateTo);
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

  /** The photo of a workout the coach may open, as bytes like `getPhoto`. */
  getPhotoForCoach(id: string): Observable<Blob> {
    return this._http.get(`${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.COACH_PHOTO(id)}`, {
      responseType: 'blob',
    });
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

  /** `defaultSets` has the server create that many empty sets with the exercise. */
  addExercise(
    workoutLogId: string,
    exerciseId: string,
    defaultSets?: number,
  ): Observable<LoggedExercise> {
    return this._http.post<LoggedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.ADD_EXERCISE(workoutLogId)}`,
      { exerciseId, ...(defaultSets ? { defaultSets } : {}) },
    );
  }

  removeExercise(
    workoutLogId: string,
    loggedExerciseId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.REMOVE_EXERCISE(
        workoutLogId,
        loggedExerciseId,
      )}`,
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
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.SKIP_EXERCISE(
        workoutLogId,
        loggedExerciseId,
      )}`,
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
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.SWAP_EXERCISE(
        workoutLogId,
        loggedExerciseId,
      )}`,
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

  /** Drop one set from an exercise mid-session — same path the set is logged on. */
  removeSet(workoutLogId: string, setId: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.LOG_SET(workoutLogId, setId)}`,
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
