import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WorkoutLogService } from './workout-log.service';
import { isSilentRequest } from '../../interceptors/silent-request.context';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

describe('WorkoutLogService', () => {
  let service: WorkoutLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkoutLogService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkoutLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // A failed "last time" lookup opened "Something went wrong" over a routine
  // builder that worked fine without it (both callers show a dash instead).
  it('looks up last time silently', () => {
    service.lastForExercise('ex-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/workout-logs/last-for-exercise/ex-1`);

    expect(isSilentRequest(req.request.context)).toBe(true);
    req.flush([]);
  });

  // The logger re-reads a workout after a refused write that already said so.
  it('reads a workout silently only when asked', () => {
    service.get('wl-1').subscribe();
    service.get('wl-1', { silent: true }).subscribe();
    const [loud, quiet] = httpMock.match(`${BASE}/workout-logs/wl-1`);

    expect(isSilentRequest(loud.request.context)).toBe(false);
    expect(isSilentRequest(quiet.request.context)).toBe(true);
    loud.flush({});
    quiet.flush({});
  });

  // The logger's "Link as superset": every changed group in one request.
  it('saves superset links in one request', () => {
    const exercises = [
      { id: 'le-1', supersetGroupId: 1 },
      { id: 'le-2', supersetGroupId: null },
    ];
    service.setSupersets('wl-1', exercises).subscribe();
    const req = httpMock.expectOne(`${BASE}/workout-logs/wl-1/supersets`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ exercises });
    req.flush(null);
  });
});
