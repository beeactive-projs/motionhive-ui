import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SearchQueryParams,
  SearchResponse,
} from '../../models/search/search.model';

/**
 * Global search service. Calls `GET /search` against the API.
 *
 * The endpoint isn't built yet — until it ships, callers should treat
 * any error (404 included) as "no results", and the modal renders the
 * empty / recents / trending state instead.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}/search`;

  search(query: SearchQueryParams): Observable<SearchResponse> {
    let params = new HttpParams().set('q', query.q);
    if (query.type) params = params.set('type', query.type);
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));
    if (query.cursor) params = params.set('cursor', query.cursor);

    return this._http.get<SearchResponse>(this._base, { params });
  }
}
