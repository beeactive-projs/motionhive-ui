import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FullProfileResponse,
  UpdateFullProfilePayload,
  UserProfile,
  UpdateUserProfilePayload,
  InstructorProfile,
  UpdateInstructorProfilePayload,
  CreateInstructorProfilePayload,
} from '../../models/profile/profile.model';
import { InstructorSearchResult } from '../../models/client/instructor.model';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${API_ENDPOINTS.PROFILE.BASE}`;

  getFullProfile(): Observable<FullProfileResponse> {
    return this._http.get<FullProfileResponse>(`${this.baseUrl}/me`);
  }

  updateFullProfile(payload: UpdateFullProfilePayload): Observable<FullProfileResponse> {
    return this._http.patch<FullProfileResponse>(`${this.baseUrl}/me`, payload);
  }

  getUserProfile(): Observable<UserProfile> {
    return this._http.get<UserProfile>(`${this.baseUrl}/user-profile`);
  }

  updateUserProfile(payload: UpdateUserProfilePayload): Observable<UserProfile> {
    return this._http.patch<UserProfile>(`${this.baseUrl}/user-profile`, payload);
  }

  createInstructorProfile(payload: CreateInstructorProfilePayload): Observable<InstructorProfile> {
    return this._http.post<InstructorProfile>(`${this.baseUrl}/instructor`, payload);
  }

  getInstructorProfile(): Observable<InstructorProfile> {
    return this._http.get<InstructorProfile>(`${this.baseUrl}/instructor`);
  }

  updateInstructorProfile(payload: UpdateInstructorProfilePayload): Observable<InstructorProfile> {
    return this._http.patch<InstructorProfile>(`${this.baseUrl}/instructor`, payload);
  }

  discoverInstructors(query?: string): Observable<InstructorSearchResult[]> {
    const params = query ? new HttpParams().set('search', query) : undefined;
    return this._http.get<InstructorSearchResult[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.DISCOVER_INSTRUCTORS}`,
      { params },
    );
  }
}
