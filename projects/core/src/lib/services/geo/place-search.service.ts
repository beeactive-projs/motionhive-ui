import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { silentRequest } from '../../interceptors/silent-request.context';
import { PickedLocation } from '../../models/user/user.model';

/**
 * Raw Nominatim response — only the fields we read. It returns many more.
 */
interface NominatimResult {
  display_name: string;
  lat?: string;
  lon?: string;
  address: {
    leisure?: string;
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** Nominatim's usage policy asks for a contact address on every request. */
const NOMINATIM_EMAIL = 'contact@motionhive.fit';
const MIN_QUERY_LENGTH = 2;

/**
 * Place lookup for the location fields, backed by OpenStreetMap's Nominatim.
 *
 * The query and the result-to-`PickedLocation` mapping used to live inside
 * web's `mh-location-picker`, which mobile cannot import — it is a PrimeNG
 * component. Only the data layer is shared; each app builds its own input.
 *
 * Requests are marked `silentRequest()`: this is a third-party endpoint on a
 * strict rate limit, and a 429 while someone is typing is not something to
 * raise a global error dialog over. The auth interceptor already skips any URL
 * outside `environment.apiUrl`, so no token leaves the app with this.
 */
@Service()
export class PlaceSearchService {
  private readonly _http = inject(HttpClient);

  /** Debouncing is the caller's job — it knows its own input. */
  search(query: string, limit = 5): Observable<PickedLocation[]> {
    if (query.trim().length < MIN_QUERY_LENGTH) return of([]);

    return this._http
      .get<NominatimResult[]>(NOMINATIM_URL, {
        params: {
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: String(limit),
          email: NOMINATIM_EMAIL,
        },
        context: silentRequest(),
      })
      .pipe(
        map((results) => results.map(toPickedLocation)),
        catchError(() => of([])),
      );
  }
}

function toPickedLocation(result: NominatimResult): PickedLocation {
  const { display_name, address, lat, lon } = result;
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    null;
  const street = [address.house_number, address.road].filter(Boolean).join(' ');

  return {
    displayName: display_name.split(',').slice(0, 2).join(',').trim(),
    line1: street || null,
    city,
    region: address.state ?? null,
    postalCode: address.postcode ?? null,
    country: address.country ?? null,
    countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    latitude: lat ? Number(lat) : null,
    longitude: lon ? Number(lon) : null,
  };
}
