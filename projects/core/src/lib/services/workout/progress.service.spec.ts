import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProgressService } from './progress.service';
import { isSilentRequest } from '../../interceptors/silent-request.context';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

describe('ProgressService', () => {
  let service: ProgressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProgressService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProgressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('overview → GET /progress/overview with the range', () => {
    service.overview('4w').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/progress/overview`);
    expect(req.request.params.get('range')).toBe('4w');
    req.flush({});
  });

  it('overviewForClient → GET /coach/clients/:id/progress/overview with the range', () => {
    service.overviewForClient('user-1', '12w').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${BASE}/coach/clients/user-1/progress/overview`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('range')).toBe('12w');
    // The screen shows its own error; no global dialog on top.
    expect(isSilentRequest(req.request.context)).toBe(true);
    req.flush({});
  });

  it('forClientExercise → GET /coach/clients/:id/progress/exercises/:exerciseId', () => {
    service.forClientExercise('user-1', 'ex-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/coach/clients/user-1/progress/exercises/ex-1`);
    expect(req.request.method).toBe('GET');
    expect(isSilentRequest(req.request.context)).toBe(true);
    req.flush({});
  });
});
