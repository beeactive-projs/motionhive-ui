import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GroupService } from './group.service';
import { isSilentRequest } from '../../interceptors/silent-request.context';
import { environment } from '../../../environments/environment';

describe('GroupService.getById', () => {
  let service: GroupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(GroupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('keeps the global error dialog by default', () => {
    service.getById('g-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/groups/g-1`);
    expect(isSilentRequest(req.request.context)).toBe(false);
    req.flush({});
  });

  it('skips it when the caller expects a refusal', () => {
    // The group preview's "are they already in?" probe: a 403 is the answer.
    service.getById('g-1', { silent: true }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/groups/g-1`);
    expect(isSilentRequest(req.request.context)).toBe(true);
    req.flush({});
  });
});
