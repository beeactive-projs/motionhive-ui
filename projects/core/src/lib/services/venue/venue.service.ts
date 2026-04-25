import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateVenuePayload,
  UpdateVenuePayload,
  Venue,
} from '../../models/venue/venue.model';

/**
 * VenueService — CRUD over the authenticated instructor's venue
 * catalogue. Ownership is enforced server-side; the FE only needs
 * to send the authenticated JWT (auth interceptor handles that).
 */
@Injectable({ providedIn: 'root' })
export class VenueService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiUrl}/venues`;

  list(): Observable<Venue[]> {
    return this._http.get<Venue[]>(this._baseUrl);
  }

  get(id: string): Observable<Venue> {
    return this._http.get<Venue>(`${this._baseUrl}/${id}`);
  }

  create(payload: CreateVenuePayload): Observable<Venue> {
    return this._http.post<Venue>(this._baseUrl, payload);
  }

  update(id: string, payload: UpdateVenuePayload): Observable<Venue> {
    return this._http.patch<Venue>(`${this._baseUrl}/${id}`, payload);
  }

  archive(id: string): Observable<void> {
    return this._http.post<void>(`${this._baseUrl}/${id}/archive`, {});
  }

  remove(id: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/${id}`);
  }
}
