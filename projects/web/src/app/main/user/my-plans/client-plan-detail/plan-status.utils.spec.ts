import { describe, expect, it } from 'vitest';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { canStartIn, planStatusDetail, planStatusMessage } from './plan-status.utils';

function plan(fields: Partial<ProgramAssignment>): ProgramAssignment {
  return {
    id: 'pa-1',
    instructorId: 'coach-1',
    completionPercent: 42,
    statusChangedAt: '2026-11-12T10:00:00Z',
    statusChangedBy: 'coach-1',
    statusMessage: null,
    ...fields,
  } as ProgramAssignment;
}

describe('plan status on the web plan page', () => {
  it('lets only a running or waiting plan start its days', () => {
    expect(canStartIn(ProgramAssignmentStatus.Active)).toBe(true);
    expect(canStartIn(ProgramAssignmentStatus.Pending)).toBe(true);
    // Cancelled offered Start and then failed with a 409.
    expect(canStartIn(ProgramAssignmentStatus.Cancelled)).toBe(false);
    expect(canStartIn(ProgramAssignmentStatus.Paused)).toBe(false);
    expect(canStartIn(ProgramAssignmentStatus.Completed)).toBe(false);
  });

  it('says since when a plan is paused and that its days are not missed', () => {
    expect(planStatusDetail(plan({ status: ProgramAssignmentStatus.Paused }), 'Andrei', 0)).toBe(
      "Paused since 12 Nov. Andrei resumes it when it's time. Paused days don't count as missed.",
    );
  });

  it('counts the finished workouts a cancelled plan leaves in the history', () => {
    expect(
      planStatusDetail(plan({ status: ProgramAssignmentStatus.Cancelled }), 'Andrei', 7),
    ).toBe('Andrei cancelled it on 12 Nov. The 7 finished workouts stay in your history.');
  });

  it('names the coach who finished a plan early, not a plan that finished on its own', () => {
    expect(
      planStatusDetail(plan({ status: ProgramAssignmentStatus.Completed }), 'Andrei', 4),
    ).toBe('Andrei marked it as finished on 12 Nov, at 42% done.');
    expect(
      planStatusDetail(
        plan({ status: ProgramAssignmentStatus.Completed, statusChangedBy: null }),
        'Andrei',
        4,
      ),
    ).toBeNull();
  });

  it('quotes the coach only for a stopped plan they changed', () => {
    expect(
      planStatusMessage(plan({ status: ProgramAssignmentStatus.Paused, statusMessage: ' Hi ' })),
    ).toBe('Hi');
    expect(
      planStatusMessage(plan({ status: ProgramAssignmentStatus.Active, statusMessage: 'Back' })),
    ).toBeNull();
  });
});
