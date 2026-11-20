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

  // Copy to other weeks is one request, never one per target week.
  it('copies a week into several weeks in one request', () => {
    service.copyWeek('p-1', 0, [1, 2, 3]).subscribe();
    const req = http.expectOne(`${BASE}/programs/p-1/workouts/copy-week`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fromWeekIndex: 0, toWeekIndexes: [1, 2, 3] });
    req.flush([]);
  });

  it('adds a week after one, and clears one, each in one request', () => {
    service.insertWeekAfter('p-1', 1).subscribe();
    const insert = http.expectOne(`${BASE}/programs/p-1/weeks/1/insert-after`);
    expect(insert.request.method).toBe('POST');
    insert.flush({});

    service.clearWeek('p-1', 2).subscribe();
    const clear = http.expectOne(`${BASE}/programs/p-1/weeks/2/workouts`);
    expect(clear.request.method).toBe('DELETE');
    clear.flush({});
  });

  it('adds every picked movement in one request', () => {
    const exercises = [
      { exerciseId: 'ex-1', defaultSets: 3 },
      { exerciseId: 'ex-2', defaultSets: 3 },
    ];
    service.addExercises('p-1', 'pw-1', exercises).subscribe();
    const req = http.expectOne(`${BASE}/programs/p-1/workouts/pw-1/exercises/bulk`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ exercises });
    req.flush([]);
  });

  // Matched by id on the server, so an assigned copy keeps its link.
  it("sets an exercise's sets in one request", () => {
    const sets = [{ id: 's-1', targetRepsMin: 8 }, { targetRepsMin: 8 }];
    service.setSets('p-1', 'pw-1', 'pe-1', sets).subscribe();
    const req = http.expectOne(`${BASE}/programs/p-1/workouts/pw-1/exercises/pe-1/sets`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ sets });
    req.flush([]);
  });
});
