import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import {
  AssignedExercise,
  AssignedSet,
  AssignedWorkout,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  WorkoutLogService,
  WorkoutLogStatus,
} from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { Preview } from './preview';

function exercise(id: string, sets: number): AssignedExercise {
  return {
    id,
    exerciseId: id,
    sets: Array.from({ length: sets }, (_, i) => ({ id: `${id}-${i}` }) as AssignedSet),
  } as AssignedExercise;
}

function day(overrides: Partial<AssignedWorkout> = {}): AssignedWorkout {
  return {
    id: 'aw-1',
    name: 'Lower body',
    notes: null,
    weekIndex: 0,
    dayIndex: 0,
    phase: null,
    scheduledDate: '2026-11-18',
    estimatedDurationMinutes: null,
    status: null,
    exercises: [exercise('squat', 3), exercise('lunge', 2)],
    ...overrides,
  } as AssignedWorkout;
}

function setup(): Preview {
  TestBed.configureTestingModule({
    providers: [
      { provide: ProgramAssignmentService, useValue: {} },
      { provide: WorkoutLogService, useValue: {} },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } },
      },
      { provide: Router, useValue: { url: '/tabs/workouts/preview/pa-1' } },
      { provide: FeedbackService, useValue: {} },
      { provide: ActiveWorkoutService, useValue: {} },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  return TestBed.runInInjectionContext(() => new Preview());
}

describe('Preview, the hero', () => {
  it('says what the day holds, the routine page’s line', () => {
    const page = setup();
    page.workout.set(day());

    expect(page.meta()).toBe('2 exercises · 5 sets');
  });

  it('puts how long it takes first, when the plan says', () => {
    const page = setup();
    page.workout.set(day({ estimatedDurationMinutes: 45 }));

    expect(page.meta()).toBe('workouts.meta.aboutMinutes · 2 exercises · 5 sets');
  });

  it('has no line before the day loads, or for a day with nothing in it', () => {
    const page = setup();
    expect(page.meta()).toBeNull();

    page.workout.set(day({ exercises: [] }));
    expect(page.meta()).toBeNull();
  });
});

describe('Preview, a day that is already behind you', () => {
  const plan = (status: ProgramAssignmentStatus) => ({ id: 'pa-1', status }) as unknown as ProgramAssignment;

  it('offers Start and Skip on a day still to do of a running plan', () => {
    const preview = setup();
    preview.assignment.set(plan(ProgramAssignmentStatus.Active));
    preview.workout.set(day());
    expect(preview.closedNote()).toBeNull();
  });

  it('says a day is done instead of offering it again', () => {
    const preview = setup();
    preview.assignment.set(plan(ProgramAssignmentStatus.Active));
    preview.workout.set(day({ status: WorkoutLogStatus.Completed }));
    expect(preview.closedNote()).toBe('workouts.preview.dayClosed');
  });

  it('lets a skipped day be made up, with Start and no second Skip', () => {
    const preview = setup();
    preview.assignment.set(plan(ProgramAssignmentStatus.Active));
    preview.workout.set(day({ status: WorkoutLogStatus.Skipped }));
    expect(preview.closedNote()).toBeNull();
    expect(preview.canSkip()).toBe(false);
  });

  it('says the plan is not running instead of offering its days', () => {
    const preview = setup();
    preview.assignment.set(plan(ProgramAssignmentStatus.Paused));
    preview.workout.set(day());
    expect(preview.closedNote()).toBe('workouts.preview.planClosed');
  });
});
