import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { WorkoutLog, WorkoutLogService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveSessionStore } from './active-session.store';
import { ActiveWorkoutService } from './active-workout.service';

/** The service with no workout open, and each start answered by the test. */
function setup(open: WorkoutLog | null = null) {
  const starts: Subject<WorkoutLog>[] = [];
  const start = vi.fn(() => {
    const reply = new Subject<WorkoutLog>();
    starts.push(reply);
    return reply as Observable<WorkoutLog>;
  });
  const navigate = vi.fn(() => Promise.resolve(true));
  const error = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutLogService, useValue: { getInProgress: () => of(open), start } },
      { provide: Router, useValue: { navigate } },
      { provide: FeedbackService, useValue: { error, info: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ActiveSessionStore, useValue: { end: vi.fn() } },
    ],
  });
  const service = TestBed.inject(ActiveWorkoutService);
  const answer = (index: number, id: string) => {
    starts[index].next({ id } as WorkoutLog);
    starts[index].complete();
  };
  const fail = (index: number) => starts[index].error({ status: 0 });
  return { service, start, navigate, error, answer, fail };
}

describe('ActiveWorkoutService.startFreestyle', () => {
  // The logger opens once, on the new workout: no `log/new` page replaced
  // under a second one sliding in.
  it('starts the workout, then opens the logger on it', () => {
    const { service, navigate, answer } = setup();

    service.startFreestyle();
    expect(navigate).not.toHaveBeenCalled();
    answer(0, 'wl-9');

    expect(navigate).toHaveBeenCalledWith(['/tabs/workouts/log', 'wl-9'], { replaceUrl: false });
  });

  it('starts one workout for a double tap', () => {
    const { service, start, answer } = setup();

    service.startFreestyle();
    service.startFreestyle();
    expect(start).toHaveBeenCalledOnce();

    answer(0, 'wl-9');
    service.startFreestyle();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('lets the next tap try again after a failed start', () => {
    const { service, start, error, fail } = setup();

    service.startFreestyle();
    fail(0);
    expect(error).toHaveBeenCalledOnce();

    service.startFreestyle();
    expect(start).toHaveBeenCalledTimes(2);
  });

  // The old `log/new` link replaces itself, so back does not land on it.
  it('replaces the page it was asked from when told to', () => {
    const { service, navigate, answer } = setup();

    service.startFreestyle(null, true);
    answer(0, 'wl-9');

    expect(navigate).toHaveBeenCalledWith(['/tabs/workouts/log', 'wl-9'], { replaceUrl: true });
  });

  it('starts nothing while another workout is open, until the person chooses', () => {
    const { service, start } = setup({ id: 'wl-open', name: 'Push day' } as WorkoutLog);

    service.startFreestyle();

    expect(start).not.toHaveBeenCalled();
    expect(service.conflict()?.open.id).toBe('wl-open');
  });
});

describe('ActiveWorkoutService.takeCarryOver', () => {
  it("hands a Repeat's source to the new workout's logger, once", () => {
    const { service, answer } = setup();

    service.startFreestyle('wl-past');
    answer(0, 'wl-9');

    expect(service.takeCarryOver('wl-other')).toBeNull();
    expect(service.takeCarryOver('wl-9')).toBe('wl-past');
    expect(service.takeCarryOver('wl-9')).toBeNull();
  });

  it('carries nothing for an empty workout', () => {
    const { service, answer } = setup();

    service.startFreestyle();
    answer(0, 'wl-9');

    expect(service.takeCarryOver('wl-9')).toBeNull();
  });
});
