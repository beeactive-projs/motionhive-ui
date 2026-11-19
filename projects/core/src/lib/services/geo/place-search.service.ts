import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';

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
/** Shorter than this, no search is asked (and nothing was "not found"). */
export const PLACE_SEARCH_MIN_LENGTH = 2;
/**
 * Nominatim usually answers within a second or two, now and then after 15 s
 * with a 503. Past this the search gives up and says so, rather than
 * spinning for as long as the server takes.
 */
export const PLACE_SEARCH_TIMEOUT_MS = 6000;
/** Answers kept for the session, so a search typed again (or after a slip) is instant. */
const CACHE_SIZE = 50;

/** A search's answer: the places, and whether the search failed (so "nothing found" is not said when it is not true). */
export interface PlaceSearchResult {
  places: PickedLocation[];
  failed: boolean;
}

export interface PlaceSearchOptions {
  limit?: number;
  /** Cities, towns and villages only (Nominatim's `featureType=settlement`): for a person's city. */
  settlements?: boolean;
}

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
  private readonly _cache = new Map<string, PickedLocation[]>();

  /** Debouncing is the caller's job — it knows its own input. A failure reads as no places. */
  search(query: string, limit = 5): Observable<PickedLocation[]> {
    return this.lookup(query, { limit }).pipe(map((result) => result.places));
  }

  /**
   * The places for `query`, held to `PLACE_SEARCH_TIMEOUT_MS`, with a slow
   * or failed answer told apart from an empty one. Answers are kept for the
   * session; failures are not, so the same search can be tried again.
   */
  lookup(query: string, options: PlaceSearchOptions = {}): Observable<PlaceSearchResult> {
    const term = query.trim();
    if (term.length < PLACE_SEARCH_MIN_LENGTH) {
      return of({ places: [], failed: false });
    }
    const limit = options.limit ?? 5;
    const key = [term.toLocaleLowerCase(), limit, !!options.settlements].join('|');
    const cached = this._cache.get(key);
    if (cached) {
      return of({ places: cached, failed: false });
    }

    const params: Record<string, string> = {
      q: term,
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      email: NOMINATIM_EMAIL,
    };
    if (options.settlements) {
      params['featureType'] = 'settlement';
    }
    return this._http.get<NominatimResult[]>(NOMINATIM_URL, { params, context: silentRequest() }).pipe(
      timeout(PLACE_SEARCH_TIMEOUT_MS),
      map((results) => results.map(toPickedLocation)),
      tap((places) => this._remember(key, places)),
      map((places) => ({ places, failed: false })),
      catchError(() => of({ places: [], failed: true })),
    );
  }

  private _remember(key: string, places: PickedLocation[]): void {
    if (this._cache.size >= CACHE_SIZE) {
      const oldest = this._cache.keys().next();
      if (!oldest.done) {
        this._cache.delete(oldest.value);
      }
    }
    this._cache.set(key, places);
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
