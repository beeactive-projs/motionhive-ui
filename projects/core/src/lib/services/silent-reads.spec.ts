import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { isSilentRequest } from '../interceptors/silent-request.context';
import { GroupService } from './group/group.service';
import { ClientPaymentService } from './payment/client-payment.service';
import { EarningsService } from './payment/earnings.service';
import { ProductService } from './payment/product.service';
import { PostService } from './post/post.service';
import { ProfileService } from './profile/profile.service';
import { SessionService } from './session/session.service';
import { VenueService } from './venue/venue.service';
import { ProgramAssignmentService } from './workout/program-assignment.service';
import { ProgramService } from './workout/program.service';
import { ProgressService } from './workout/progress.service';
import { WorkoutLogService } from './workout/workout-log.service';

/**
 * Reads a screen may take over the failure of: silent only when the caller
 * says it shows its own failure state, so every other caller keeps the
 * global error dialog it relies on.
 */
describe('silent reads', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const cases: [string, string, (silent?: boolean) => void][] = [
    [
      'ProfileService.getMyProfile',
      `${environment.apiUrl}${API_ENDPOINTS.PROFILE.BASE}/me`,
      (silent) =>
        TestBed.inject(ProfileService)
          .getMyProfile(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProductService.list',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.PRODUCTS}`,
      (silent) =>
        TestBed.inject(ProductService)
          .list({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'EarningsService.getSummary',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.EARNINGS}`,
      (silent) =>
        TestBed.inject(EarningsService)
          .getSummary(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ClientPaymentService.getMyCounts',
      `${environment.apiUrl}${API_ENDPOINTS.PAYMENTS.MY_COUNTS}`,
      (silent) =>
        TestBed.inject(ClientPaymentService)
          .getMyCounts(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'VenueService.list',
      `${environment.apiUrl}/venues`,
      (silent) =>
        TestBed.inject(VenueService)
          .list(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    // The Homes' blocks: each shows its own failure or empty state.
    [
      'ProgramAssignmentService.listForInstructor',
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.BASE}`,
      (silent) =>
        TestBed.inject(ProgramAssignmentService)
          .listForInstructor({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProgramAssignmentService.trainingDay',
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAM_ASSIGNMENTS.MY_TODAY}`,
      (silent) =>
        TestBed.inject(ProgramAssignmentService)
          .trainingDay(undefined, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'SessionService.listInstances',
      `${environment.apiUrl}${API_ENDPOINTS.SESSIONS.INSTANCES}`,
      (silent) =>
        TestBed.inject(SessionService)
          .listInstances({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'SessionService.listMy',
      `${environment.apiUrl}${API_ENDPOINTS.SESSIONS.MY}`,
      (silent) =>
        TestBed.inject(SessionService)
          .listMy({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'WorkoutLogService.list',
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.BASE}`,
      (silent) =>
        TestBed.inject(WorkoutLogService)
          .list({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'WorkoutLogService.getInProgress',
      `${environment.apiUrl}${API_ENDPOINTS.WORKOUT_LOGS.IN_PROGRESS}`,
      (silent) =>
        TestBed.inject(WorkoutLogService)
          .getInProgress(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProgressService.overview',
      `${environment.apiUrl}/progress/overview?range=4w`,
      (silent) =>
        TestBed.inject(ProgressService)
          .overview('4w', silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProgressService.trainedExercises',
      `${environment.apiUrl}/progress/exercises`,
      (silent) =>
        TestBed.inject(ProgressService)
          .trainedExercises(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProgressService.forExercise',
      `${environment.apiUrl}/progress/exercises/ex-1`,
      (silent) =>
        TestBed.inject(ProgressService)
          .forExercise('ex-1', silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'GroupService.getMyGroups',
      `${environment.apiUrl}${API_ENDPOINTS.GROUPS.BASE}`,
      (silent) =>
        TestBed.inject(GroupService)
          .getMyGroups(silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'PostService.getFeed',
      `${environment.apiUrl}${API_ENDPOINTS.POSTS.FEED}?page=1&limit=20`,
      (silent) =>
        TestBed.inject(PostService)
          .getFeed(1, 20, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
    [
      'ProgramService.list',
      `${environment.apiUrl}${API_ENDPOINTS.PROGRAMS.BASE}`,
      (silent) =>
        TestBed.inject(ProgramService)
          .list({}, silent === undefined ? undefined : { silent })
          .subscribe(),
    ],
  ];

  for (const [name, url, call] of cases) {
    it(`${name} keeps the dialog by default`, () => {
      call();
      const req = httpMock.expectOne(url);
      expect(isSilentRequest(req.request.context)).toBe(false);
      req.flush({});
    });

    it(`${name} skips it when the screen reports the failure itself`, () => {
      call(true);
      const req = httpMock.expectOne(url);
      expect(isSilentRequest(req.request.context)).toBe(true);
      req.flush({});
    });
  }
});
