import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UpdateUserPayload } from '../../models/user/user.model';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly _http = inject(HttpClient);

  getMe(): Observable<User> {
    return this._http.get<User>(`${environment.apiUrl}${API_ENDPOINTS.USERS.ME}`);
  }

  updateMe(payload: UpdateUserPayload): Observable<User> {
    return this._http.patch<User>(`${environment.apiUrl}${API_ENDPOINTS.USERS.ME}`, payload);
  }

  /**
   * Upload a new profile picture. Backend accepts multipart/form-data
   * with a single `file` field. Returns the new Cloudinary URL so the
   * caller can swap the avatar in place without refetching the whole
   * profile.
   */
  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this._http.post<{ avatarUrl: string }>(
      `${environment.apiUrl}${API_ENDPOINTS.USERS.ME_AVATAR}`,
      formData,
    );
  }
}
