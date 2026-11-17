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
});
