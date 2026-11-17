import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RoutineService } from './routine.service';
import { isSilentRequest } from '../../interceptors/silent-request.context';
import type { Routine } from '../../models/workout/routine.model';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

/** One routine on the wire: a program with a single workout. */
function wire(sets: Record<string, unknown>[]) {
  return {
    id: 'r-1',
    ownerId: 'u-1',
    name: 'Run day',
    description: null,
    folder: null,
    isSingleWorkout: true,
    lastPerformedAt: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    workouts: [
      {
        id: 'w-1',
        name: 'Run day',
        exercises: [
          {
            id: 'pe-1',
            exerciseId: 'ex-1',
            orderIndex: 0,
            supersetGroupId: null,
            notes: null,
            sets: sets.map((set, orderIndex) => ({
              orderIndex,
              setType: 'NORMAL',
              targetRepsMin: null,
              targetRepsMax: null,
              targetWeightKg: null,
              targetDurationSeconds: null,
              restAfterSeconds: null,
              ...set,
            })),
          },
        ],
      },
    ],
  };
}

describe('RoutineService', () => {
  let service: RoutineService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RoutineService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(RoutineService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function read(sets: Record<string, unknown>[]): Routine {
    let routine: Routine | null = null;
    service.get('r-1').subscribe((r) => (routine = r));
    httpMock.expectOne(`${BASE}/programs/r-1`).flush(wire(sets));
    return routine!;
  }

  // A routine's run targets came back without their distance, so the
  // builder saved them away on the next edit.
  it('reads a set’s distance target', () => {
    const routine = read([{ targetDistanceMeters: 400, targetDurationSeconds: 90 }]);

    expect(routine.exercises?.[0].sets[0].targetDistanceMeters).toBe(400);
    expect(routine.exercises?.[0].sets[0].targetDurationSeconds).toBe(90);
  });

  it('reads a missing distance as none', () => {
    const routine = read([{}]);

    expect(routine.exercises?.[0].sets[0].targetDistanceMeters).toBeNull();
  });

  it('calls sets varied when only their distances differ', () => {
    const routine = read([{ targetDistanceMeters: 400 }, { targetDistanceMeters: 800 }]);

    expect(routine.exercises?.[0].hasVariedSets).toBe(true);
  });

  // The builder draws its own "Couldn't open this routine"; the global
  // dialog opened over it as well.
  it('reads silently when asked, so the screen reports its own failure', () => {
    service.get('r-1', { silent: true }).subscribe();
    const req = httpMock.expectOne(`${BASE}/programs/r-1`);

    expect(isSilentRequest(req.request.context)).toBe(true);
    req.flush(wire([{}]));
  });

  it('reads loudly by default', () => {
    service.get('r-1').subscribe();
    const req = httpMock.expectOne(`${BASE}/programs/r-1`);

    expect(isSilentRequest(req.request.context)).toBe(false);
    req.flush(wire([{}]));
  });
});
