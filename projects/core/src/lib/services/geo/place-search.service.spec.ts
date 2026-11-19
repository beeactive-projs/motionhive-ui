import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PLACE_SEARCH_TIMEOUT_MS, PlaceSearchResult, PlaceSearchService } from './place-search.service';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const cluj = {
  display_name: 'Cluj-Napoca, Cluj County, Romania',
  lat: '46.77',
  lon: '23.6',
  address: { city: 'Cluj-Napoca', state: 'Cluj County', country: 'Romania', country_code: 'ro' },
};

describe('PlaceSearchService', () => {
  let service: PlaceSearchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlaceSearchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function lookup(query: string, settlements = false): PlaceSearchResult[] {
    const answers: PlaceSearchResult[] = [];
    service.lookup(query, { settlements }).subscribe((answer) => answers.push(answer));
    return answers;
  }

  it('asks nothing for a query too short to mean a place', () => {
    expect(lookup('C')).toEqual([{ places: [], failed: false }]);
  });

  it('asks for settlements only when the field is a city', () => {
    lookup('Cluj', true);
    const request = http.expectOne((req) => req.url === NOMINATIM);
    expect(request.request.params.get('featureType')).toBe('settlement');
    expect(request.request.params.get('q')).toBe('Cluj');
    request.flush([cluj]);
  });

  it('answers a search typed again from what it already found', () => {
    const first = lookup('Cluj');
    http.expectOne((req) => req.url === NOMINATIM).flush([cluj]);
    expect(first[0].places[0].city).toBe('Cluj-Napoca');

    const again = lookup(' cluj ');
    http.expectNone((req) => req.url === NOMINATIM);
    expect(again[0]).toEqual({ places: first[0].places, failed: false });
  });

  it('says a failed search failed, and tries it again next time', () => {
    const failed = lookup('Iasi');
    http.expectOne((req) => req.url === NOMINATIM).flush('busy', { status: 503, statusText: 'Unavailable' });
    expect(failed).toEqual([{ places: [], failed: true }]);

    lookup('Iasi');
    http.expectOne((req) => req.url === NOMINATIM).flush([]);
  });

  it('gives up on a search that takes too long', () => {
    vi.useFakeTimers();
    const slow = lookup('Bucur');
    const request = http.expectOne((req) => req.url === NOMINATIM);
    vi.advanceTimersByTime(PLACE_SEARCH_TIMEOUT_MS);
    expect(slow).toEqual([{ places: [], failed: true }]);
    expect(request.cancelled).toBe(true);
  });

  it('keeps search() for the fields that only need the places', () => {
    const places: unknown[] = [];
    service.search('Cluj').subscribe((found) => places.push(found));
    http.expectOne((req) => req.url === NOMINATIM).flush([cluj]);
    expect(places).toHaveLength(1);
  });
});
