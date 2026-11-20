import { describe, expect, it } from 'vitest';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { PlanOptionIds, planOptionActions } from './assignments.config';

const row = (status: ProgramAssignmentStatus) => ({ id: 'a-1', status }) as ProgramAssignment;

describe("a plan's ⋯ on the Assignments page", () => {
  it("offers the client's copy first while the plan runs or is paused", () => {
    for (const status of [ProgramAssignmentStatus.Active, ProgramAssignmentStatus.Paused]) {
      const actions = planOptionActions(row(status), 'Anna');
      expect(actions.map((action) => action.id)).toEqual([PlanOptionIds.EditCopy, PlanOptionIds.ChangeStatus]);
      expect(actions[0]).toEqual(
        expect.objectContaining({ label: "Edit Anna's copy", icon: 'create-outline', color: 'teal' }),
      );
    }
  });

  it('keeps only the status sheet for a plan waiting to start', () => {
    expect(planOptionActions(row(ProgramAssignmentStatus.Pending), 'Anna').map((action) => action.id)).toEqual([
      PlanOptionIds.ChangeStatus,
    ]);
  });
});
