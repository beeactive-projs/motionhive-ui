import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { AssignedWorkout, ProgramAssignment, ProgramAssignmentService, WorkoutLogStatus } from 'core';

import { PlanStore } from './plan.store';

function day(weekIndex: number, dayIndex: number, status: WorkoutLogStatus | null): AssignedWorkout {
  return { id: `w${weekIndex}-${dayIndex}`, weekIndex, dayIndex, status, scheduledDate: null } as unknown as AssignedWorkout;
}

function store(workouts: AssignedWorkout[]): PlanStore {
  const assignment = { id: 'pa-1', workouts } as unknown as ProgramAssignment;
  TestBed.configureTestingModule({
    providers: [
      PlanStore,
      { provide: ProgramAssignmentService, useValue: { get: () => of(assignment) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const plan = TestBed.inject(PlanStore);
  plan.load('pa-1');
  return plan;
}

describe('PlanStore, the week the trainee is in', () => {
  it('moves past a week whose days were trained or skipped', () => {
    const plan = store([
      day(0, 0, WorkoutLogStatus.Completed),
      day(0, 2, WorkoutLogStatus.Skipped),
      day(1, 0, null),
      day(1, 2, null),
    ]);
    expect(plan.currentWeek()).toBe(1);
    // The count still says what was trained.
    expect(plan.weeks()[0].done).toBe(1);
  });

  it('stays on a week with a day still to do', () => {
    const plan = store([day(0, 0, WorkoutLogStatus.Skipped), day(0, 2, null), day(1, 0, null)]);
    expect(plan.currentWeek()).toBe(0);
  });

  it('shows the last week once every day is dealt with, by its own index', () => {
    const plan = store([day(0, 0, WorkoutLogStatus.Completed), day(1, 0, WorkoutLogStatus.Skipped)]);
    expect(plan.currentWeek()).toBe(1);
  });

  it('keeps week indexes that do not start at 0', () => {
    const plan = store([day(1, 0, WorkoutLogStatus.Completed), day(2, 0, WorkoutLogStatus.Completed)]);
    expect(plan.currentWeek()).toBe(2);
  });
});
