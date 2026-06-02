import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import type {
  CreatePrescribedExercisePayload,
  CreatePrescribedSetPayload,
  CreateProgramPayload,
  CreateProgramWorkoutPayload,
  ListProgramsQuery,
  PaginatedPrograms,
  PrescribedExercise,
  PrescribedSet,
  Program,
  ProgramWorkout,
  UpdatePrescribedExercisePayload,
  UpdatePrescribedSetPayload,
  UpdateProgramPayload,
  UpdateProgramWorkoutPayload,
} from '../../models/workout/program.model';

/**
 * ProgramService — REST wrapper over `/programs/...` (instructor-only
 * surface server-side). Mirrors the BE nested CRUD shape: program →
 * workout → exercise slot → set. Ownership is server-enforced; the FE
 * just sends the authenticated JWT (auth interceptor).
 */
@Injectable({ providedIn: 'root' })
export class ProgramService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.BASE}`;

  // ── Program ──────────────────────────────────────────────────────

  list(query: ListProgramsQuery = {}): Observable<PaginatedPrograms> {
    let p = new HttpParams();
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.search) p = p.set('search', query.search);
    if (query.status) p = p.set('status', query.status);
    return this._http.get<PaginatedPrograms>(this._baseUrl, { params: p });
  }

  /** Full tree — workouts, exercise slots, sets, catalog exercise refs. */
  get(id: string): Observable<Program> {
    return this._http.get<Program>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.BY_ID(id)}`,
    );
  }

  create(payload: CreateProgramPayload): Observable<Program> {
    return this._http.post<Program>(this._baseUrl, payload);
  }

  update(id: string, payload: UpdateProgramPayload): Observable<Program> {
    return this._http.patch<Program>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.BY_ID(id)}`,
      payload,
    );
  }

  remove(id: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.BY_ID(id)}`,
    );
  }

  // ── Workout (nested) ─────────────────────────────────────────────

  addWorkout(
    programId: string,
    payload: CreateProgramWorkoutPayload,
  ): Observable<ProgramWorkout> {
    return this._http.post<ProgramWorkout>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.WORKOUTS(programId)}`,
      payload,
    );
  }

  updateWorkout(
    programId: string,
    workoutId: string,
    payload: UpdateProgramWorkoutPayload,
  ): Observable<ProgramWorkout> {
    return this._http.patch<ProgramWorkout>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.WORKOUT_BY_ID(programId, workoutId)}`,
      payload,
    );
  }

  removeWorkout(programId: string, workoutId: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.WORKOUT_BY_ID(programId, workoutId)}`,
    );
  }

  // ── Prescribed exercise (nested under workout) ───────────────────

  addExercise(
    programId: string,
    workoutId: string,
    payload: CreatePrescribedExercisePayload,
  ): Observable<PrescribedExercise> {
    return this._http.post<PrescribedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.EXERCISES(programId, workoutId)}`,
      payload,
    );
  }

  updateExercise(
    programId: string,
    workoutId: string,
    exerciseId: string,
    payload: UpdatePrescribedExercisePayload,
  ): Observable<PrescribedExercise> {
    return this._http.patch<PrescribedExercise>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.EXERCISE_BY_ID(programId, workoutId, exerciseId)}`,
      payload,
    );
  }

  removeExercise(
    programId: string,
    workoutId: string,
    exerciseId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.EXERCISE_BY_ID(programId, workoutId, exerciseId)}`,
    );
  }

  // ── Prescribed set (nested under exercise) ───────────────────────

  addSet(
    programId: string,
    workoutId: string,
    exerciseId: string,
    payload: CreatePrescribedSetPayload,
  ): Observable<PrescribedSet> {
    return this._http.post<PrescribedSet>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.SETS(programId, workoutId, exerciseId)}`,
      payload,
    );
  }

  updateSet(
    programId: string,
    workoutId: string,
    exerciseId: string,
    setId: string,
    payload: UpdatePrescribedSetPayload,
  ): Observable<PrescribedSet> {
    return this._http.patch<PrescribedSet>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.SET_BY_ID(programId, workoutId, exerciseId, setId)}`,
      payload,
    );
  }

  removeSet(
    programId: string,
    workoutId: string,
    exerciseId: string,
    setId: string,
  ): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.SET_BY_ID(programId, workoutId, exerciseId, setId)}`,
    );
  }
}
