import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ExerciseService } from './exercise.service';
import { environment } from '../../../environments/environment';
import { ExerciseSortKey } from '../../models/exercise/exercise.enums';

const LIST_URL = `${environment.apiUrl}/exercises`;

describe('ExerciseService', () => {
  let service: ExerciseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ExerciseService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ExerciseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // An API older than `relevance` answers 400 to the word, and the new one
  // defaults to it: leaving it out works against both.
  it('list never sends the default sort', () => {
    service.list({ search: 'squat', sort: ExerciseSortKey.Relevance }).subscribe();
    const req = httpMock.expectOne((r) => r.url === LIST_URL);
    expect(req.request.params.has('sort')).toBe(false);
    expect(req.request.params.get('search')).toBe('squat');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('list sends any other sort', () => {
    service.list({ sort: ExerciseSortKey.Name }).subscribe();
    const req = httpMock.expectOne((r) => r.url === LIST_URL);
    expect(req.request.params.get('sort')).toBe('name');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});
