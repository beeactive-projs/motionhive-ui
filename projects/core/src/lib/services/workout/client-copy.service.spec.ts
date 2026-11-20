import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ClientCopyService } from './client-copy.service';

const BASE = `${environment.apiUrl}/program-assignments/a-1/copy`;

/** One request per action on a client's copy, under the assignment. */
describe('ClientCopyService', () => {
  let service: ClientCopyService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientCopyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the copy and one of its days', () => {
    service.overview('a-1').subscribe();
    expect(http.expectOne(BASE).request.method).toBe('GET');
    service.day('a-1', 'd-1').subscribe();
    expect(http.expectOne(`${BASE}/days/d-1`).request.method).toBe('GET');
  });

  it("saves an exercise's sets in one request, by id", () => {
    const sets = [{ id: 's-1', targetRepsMin: 8, targetRepsMax: 8 }, { targetRepsMin: 8 }];
    service.setSets('a-1', 'd-1', 'ae-1', sets).subscribe();
    const req = http.expectOne(`${BASE}/days/d-1/exercises/ae-1/sets`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ sets });
    req.flush([]);
  });

  it('swaps an exercise, adds several in one request, reorders and removes', () => {
    service.updateExercise('a-1', 'd-1', 'ae-1', { exerciseId: 'ex-2' }).subscribe();
    const swap = http.expectOne(`${BASE}/days/d-1/exercises/ae-1`);
    expect(swap.request.method).toBe('PATCH');
    expect(swap.request.body).toEqual({ exerciseId: 'ex-2' });

    const exercises = [{ exerciseId: 'ex-3', defaultSets: 3 }];
    service.addExercises('a-1', 'd-1', exercises).subscribe();
    const add = http.expectOne(`${BASE}/days/d-1/exercises/bulk`);
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ exercises });

    const items = [{ id: 'ae-1', orderIndex: 1 }];
    service.reorderExercises('a-1', 'd-1', { items }).subscribe();
    const reorder = http.expectOne(`${BASE}/days/d-1/exercises/reorder`);
    expect(reorder.request.method).toBe('PATCH');
    expect(reorder.request.body).toEqual({ items });

    service.removeExercise('a-1', 'd-1', 'ae-1').subscribe();
    expect(http.expectOne(`${BASE}/days/d-1/exercises/ae-1`).request.method).toBe('DELETE');
  });

  it("reverts an exercise, moves a day, and says Done", () => {
    service.revert('a-1', 'd-1', 'ae-1').subscribe();
    expect(http.expectOne(`${BASE}/days/d-1/exercises/ae-1/revert`).request.method).toBe('POST');

    service.moveDay('a-1', 'd-1', '2026-11-26').subscribe();
    const move = http.expectOne(`${BASE}/days/d-1/date`);
    expect(move.request.method).toBe('PATCH');
    expect(move.request.body).toEqual({ date: '2026-11-26' });

    service.done('a-1').subscribe();
    const done = http.expectOne(`${BASE}/done`);
    expect(done.request.method).toBe('POST');
    done.flush({ notified: true, days: 1 });
  });
});
