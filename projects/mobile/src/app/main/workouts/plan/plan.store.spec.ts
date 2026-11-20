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

describe("PlanStore, the coach's note", () => {
  function withAssignment(fields: Record<string, unknown>): PlanStore {
    const assignment = { id: 'pa-1', workouts: [], ...fields } as unknown as ProgramAssignment;
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

  it('shows what the coach wrote when they gave the plan', () => {
    const plan = withAssignment({
      notes: '  Easy first week.  ',
      instructor: { id: 'coach-1', firstName: 'Alex', lastName: 'Rivera' },
    });
    expect(plan.coachNote()).toBe('Easy first week.');
  });

  it('shows nothing for an empty note, or a plan with no coach', () => {
    expect(withAssignment({ notes: '   ', instructor: { id: 'c', firstName: 'A' } }).coachNote()).toBeNull();
    TestBed.resetTestingModule();
    expect(withAssignment({ notes: 'Mine', instructor: null }).coachNote()).toBeNull();
  });
});

describe('PlanStore, a plan the coach stopped', () => {
  const coach = { id: 'coach-1', firstName: 'Andrei', lastName: 'Pop' };

  function withPlan(fields: Record<string, unknown>, workouts: AssignedWorkout[] = []): PlanStore {
    const assignment = {
      id: 'pa-1',
      instructorId: 'coach-1',
      instructor: coach,
      completionPercent: 42,
      workouts,
      ...fields,
    } as unknown as ProgramAssignment;
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

  it('says since when it is paused, that its days are not missed, and quotes the coach', () => {
    const plan = withPlan({
      status: 'PAUSED',
      statusChangedAt: '2026-11-19T10:00:00Z',
      statusChangedBy: 'coach-1',
      statusMessage: ' Vacanță plăcută! ',
    });
    expect(plan.isRunning()).toBe(false);
    expect(plan.statusLine()).toBe(
      "Paused since 19 Nov. Andrei resumes it when it's time. Paused days don't count as missed.",
    );
    expect(plan.statusMessage()).toBe('Vacanță plăcută!');
    expect(plan.statusAction()).toBe('message');
  });

  it('counts the finished workouts of a cancelled plan, which stay in the history', () => {
    const plan = withPlan(
      { status: 'CANCELLED', statusChangedAt: '2026-11-12T10:00:00Z', statusChangedBy: 'coach-1' },
      [day(0, 0, WorkoutLogStatus.Completed), day(0, 2, WorkoutLogStatus.Completed), day(1, 0, null)],
    );
    expect(plan.statusLine()).toBe(
      'Andrei cancelled it on 12 Nov. The 2 finished workouts stay in your history.',
    );
    expect(plan.statusAction()).toBe('history');
  });

  it('tells a plan the coach finished from one that finished on its own', () => {
    const byCoach = withPlan({
      status: 'COMPLETED',
      statusChangedAt: '2026-11-12T10:00:00Z',
      statusChangedBy: 'coach-1',
    });
    expect(byCoach.statusLine()).toBe('Andrei marked it as finished on 12 Nov, at 42% done.');
    TestBed.resetTestingModule();
    const onItsOwn = withPlan({
      status: 'COMPLETED',
      statusChangedAt: '2026-11-12T10:00:00Z',
      statusChangedBy: null,
      statusMessage: 'stale',
    });
    expect(onItsOwn.statusLine()).toBe('Every day of it is behind you, 42% done.');
    // A message from an earlier change is not this change's.
    expect(onItsOwn.statusMessage()).toBeNull();
  });

  it('says nothing for a running plan, which keeps its days startable', () => {
    const plan = withPlan({ status: 'ACTIVE' });
    expect(plan.isRunning()).toBe(true);
    expect(plan.statusLine()).toBeNull();
    expect(plan.statusChip()).toBeNull();
  });

  it('reads an old paused plan with no recorded date', () => {
    const plan = withPlan({ status: 'PAUSED', statusChangedAt: null, instructor: null });
    expect(plan.statusLine()).toBe(
      "Paused. workouts.home.yourCoach resumes it when it's time. Paused days don't count as missed.",
    );
  });
});
