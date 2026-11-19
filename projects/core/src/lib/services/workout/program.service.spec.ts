import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ProgramService } from './program.service';

const BASE = environment.apiUrl;

describe('ProgramService', () => {
  let service: ProgramService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProgramService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // A link on a program day renumbers its neighbours: every change in one request.
  it("saves a day's superset links in one request", () => {
    const exercises = [
      { id: 'pe-1', supersetGroupId: 2 },
      { id: 'pe-2', supersetGroupId: null },
    ];
    service.setSupersets('p-1', 'pw-1', exercises).subscribe();
    const req = http.expectOne(`${BASE}/programs/p-1/workouts/pw-1/supersets`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ exercises });
    req.flush(null);
  });
});
