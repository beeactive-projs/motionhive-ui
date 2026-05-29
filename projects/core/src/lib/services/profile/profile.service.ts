import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  MyProfile,
  UpdateMyProfilePayload,
  UserPrivacySettings,
} from '../../models/profile/profile.model';
import {
  InstructorProfile,
  UpdateInstructorProfilePayload,
  CreateInstructorProfilePayload,
} from '../../models/profile/instructor-profile.model';
import {
  InstructorSearchResult,
  PublicInstructorProfile,
} from '../../models/client/instructor.model';
import { PaginatedReviews } from '../../models/review/review.model';
import { InstructorGroupSummary } from '../../models/profile/instructor-group-summary.model';
import { PublicUserProfile } from '../../models/profile/public-user-profile.model';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';

export interface ListReviewsParams {
  cursor?: string;
  limit?: number;
  rating?: number;
  breakdown?: boolean;
}

/**
 * Shape of the PATCH /profile/me response. The backend returns ONLY
 * the sections that were updated (partial), using `instructor` rather
 * than `instructorProfile`. `mapProfile` normalises that into the
 * canonical `MyProfile` shape the rest of the FE expects.
 *
 * GET /profile/me already returns the canonical shape and does not
 * need this transform — it's wired straight to `getMyProfile`.
 */
interface UpdateMyProfileResponse {
  account?: MyProfile['account'] | { [key: string]: unknown };
  user?: MyProfile['account'];
  roles?: string[];
  instructorProfile?: MyProfile['instructorProfile'];
  instructor?: MyProfile['instructorProfile'];
}

function mapProfile(data: UpdateMyProfileResponse): MyProfile {
  return {
    account: (data.account ?? data.user) as MyProfile['account'],
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
    // GET returns the canonical MyProfile shape directly — no transform.
    return this._http.get<MyProfile>(`${this._baseUrl}/me`);
  }

  updateMyProfile(payload: UpdateMyProfilePayload): Observable<MyProfile> {
    // PATCH returns a partial with `instructor` rather than
    // `instructorProfile`; mapProfile normalises it.
    return this._http
      .patch<UpdateMyProfileResponse>(`${this._baseUrl}/me`, payload)
      .pipe(map(mapProfile));
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

  /**
   * Public Profile page lookup. Powers `/@<handle>`.
   */
  getInstructorByHandle(handle: string): Observable<PublicInstructorProfile> {
    return this._http.get<PublicInstructorProfile>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.INSTRUCTOR_BY_HANDLE(handle)}`,
    );
  }

  /**
   * Cursor-paginated reviews for an instructor. Pass `breakdown: true`
   * on the first page to get the rating distribution in the same call.
   */
  getInstructorReviews(
    instructorUserId: string,
    params: ListReviewsParams = {},
  ): Observable<PaginatedReviews> {
    let httpParams = new HttpParams();
    if (params.cursor) httpParams = httpParams.set('cursor', params.cursor);
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    if (params.rating != null) httpParams = httpParams.set('rating', String(params.rating));
    if (params.breakdown) httpParams = httpParams.set('breakdown', 'true');
    return this._http.get<PaginatedReviews>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.INSTRUCTOR_REVIEWS(instructorUserId)}`,
      { params: httpParams },
    );
  }

  /**
   * Public groups owned by an instructor. Powers the Groups tab.
   */
  getInstructorGroups(instructorUserId: string): Observable<InstructorGroupSummary[]> {
    return this._http.get<InstructorGroupSummary[]>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.INSTRUCTOR_GROUPS(instructorUserId)}`,
    );
  }

  /**
   * `/@<handle>` for any user — also resolves instructors but doesn't
   * include their richer instructor-only payload (offerings, reviews).
   * The server returns `isInstructor: true` for instructor accounts so
   * callers can fan out to `getInstructorByHandle()` in parallel.
   */
  getUserByHandle(handle: string): Observable<PublicUserProfile> {
    return this._http.get<PublicUserProfile>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.USER_BY_HANDLE(handle)}`,
    );
  }

  /**
   * Patch one or more per-field privacy levels. The body is partial,
   * so the privacy chooser can ship a one-field PATCH when the user
   * flips a single dropdown. Response is the full merged settings map.
   */
  updatePrivacy(
    patch: UserPrivacySettings,
  ): Observable<{ privacySettings: UserPrivacySettings }> {
    return this._http.patch<{ privacySettings: UserPrivacySettings }>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.PRIVACY}`,
      patch,
    );
  }

  /** Claim or rename the profile handle. Throws 409 if already taken. */
  updateHandle(handle: string): Observable<{ handle: string }> {
    return this._http.patch<{ handle: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.HANDLE}`,
      { handle },
    );
  }
}
