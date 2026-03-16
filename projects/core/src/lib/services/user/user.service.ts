import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../../models/user/user.model';
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
}
