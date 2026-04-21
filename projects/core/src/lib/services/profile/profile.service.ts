import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { MyProfile, UpdateMyProfilePayload } from '../../models/profile/profile.model';
import {
  FitnessProfile,
  UpdateFitnessProfilePayload,
  BodyMeasurement,
  CreateBodyMeasurementPayload,
  FitnessGoal,
  CreateFitnessGoalPayload,
  UpdateFitnessGoalPayload,
} from '../../models/profile/fitness-profile.model';
import {
  InstructorProfile,
  UpdateInstructorProfilePayload,
  CreateInstructorProfilePayload,
} from '../../models/profile/instructor-profile.model';
import { InstructorSearchResult } from '../../models/client/instructor.model';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';

function mapProfile(data: any): MyProfile {
  return {
    account: data.account ?? data.user ?? data,
    roles: data.roles ?? [],
    instructorProfile: data.instructorProfile ?? data.instructor ?? null,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PROFILE.BASE}`;

  getMyProfile(): Observable<MyProfile> {
    return this._http.get<any>(`${this._baseUrl}/me`).pipe(map(mapProfile));
  }

  updateMyProfile(payload: UpdateMyProfilePayload): Observable<MyProfile> {
    return this._http.patch<any>(`${this._baseUrl}/me`, payload).pipe(map(mapProfile));
  }

  getFitnessProfile(): Observable<FitnessProfile> {
    return this._http.get<FitnessProfile>(`${this._baseUrl}/user-profile`);
  }

  updateFitnessProfile(payload: UpdateFitnessProfilePayload): Observable<FitnessProfile> {
    return this._http.patch<FitnessProfile>(`${this._baseUrl}/user-profile`, payload);
  }

  createInstructorProfile(payload: CreateInstructorProfilePayload): Observable<InstructorProfile> {
    return this._http.post<InstructorProfile>(`${this._baseUrl}/instructor`, payload);
  }

  getInstructorProfile(): Observable<InstructorProfile> {
    return this._http.get<InstructorProfile>(`${this._baseUrl}/instructor`);
  }

  updateInstructorProfile(payload: UpdateInstructorProfilePayload): Observable<InstructorProfile> {
    return this._http.patch<InstructorProfile>(`${this._baseUrl}/instructor`, payload);
  }

  discoverInstructors(query?: string): Observable<InstructorSearchResult[]> {
    const params = query ? new HttpParams().set('search', query) : undefined;
    return this._http.get<InstructorSearchResult[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.DISCOVER_INSTRUCTORS}`,
      { params },
    );
  }

  // Measurements
  getMeasurements(): Observable<BodyMeasurement[]> {
    return this._http.get<BodyMeasurement[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.MEASUREMENTS}`,
    );
  }

  addMeasurement(payload: CreateBodyMeasurementPayload): Observable<BodyMeasurement> {
    return this._http.post<BodyMeasurement>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.MEASUREMENTS}`,
      payload,
    );
  }

  deleteMeasurement(id: string): Observable<void> {
    return this._http.delete<void>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.MEASUREMENTS}/${id}`,
    );
  }

  // Goals
  getGoals(): Observable<FitnessGoal[]> {
    return this._http.get<FitnessGoal[]>(`${environment.apiUrl}${API_ENDPOINTS.PROFILE.GOALS}`);
  }

  createGoal(payload: CreateFitnessGoalPayload): Observable<FitnessGoal> {
    return this._http.post<FitnessGoal>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.GOALS}`,
      payload,
    );
  }

  updateGoal(id: string, payload: UpdateFitnessGoalPayload): Observable<FitnessGoal> {
    return this._http.patch<FitnessGoal>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.GOAL_BY_ID(id)}`,
      payload,
    );
  }

  deleteGoal(id: string): Observable<void> {
    return this._http.delete<void>(`${environment.apiUrl}${API_ENDPOINTS.PROFILE.GOAL_BY_ID(id)}`);
  }
}
