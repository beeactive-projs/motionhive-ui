import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { silentRequest } from '../../interceptors/silent-request.context';
import type { Category } from '../../models/onboarding/onboarding.model';

/** MotionHive's category list. Read through `CategoryStore`, which caches it. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}${API_ENDPOINTS.CATEGORIES.BASE}`;

  /** Silent: every screen reading it copes with an empty list. */
  list(): Observable<Category[]> {
    return this._http.get<Category[]>(this._baseUrl, { context: silentRequest() });
  }
}
