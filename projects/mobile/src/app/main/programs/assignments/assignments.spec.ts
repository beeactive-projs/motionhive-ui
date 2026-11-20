import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { Assignments } from './assignments';
import { AssignmentsStore } from './assignments.store';

const row = (status: ProgramAssignmentStatus) =>
  ({
    id: 'a-1',
    clientId: 'c-1',
    status,
    client: { id: 'c-1', firstName: 'Anna', lastName: 'Popescu' },
  }) as ProgramAssignment;

function setup() {
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: AssignmentsStore, useValue: { load: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p-1' }) } } },
      { provide: Router, useValue: { url: '/tabs/programs/program/p-1/assignments', navigate } },
      { provide: FeedbackService, useValue: { error: vi.fn(), success: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new Assignments());
  return { page, navigate };
}

describe("Assignments, a plan's ⋯", () => {
  it("offers the client's copy, which opens in this stack", () => {
    const { page, navigate } = setup();
    page.openOptions(row(ProgramAssignmentStatus.Active));
    expect(page.optionsOpen()).toBe(true);
    expect(page.optionActions().map((action) => action.id)).toEqual(['editCopy', 'changeStatus']);

    page.onOption('editCopy');
    expect(navigate).toHaveBeenCalledWith(['/tabs/programs', 'copy', 'a-1']);
    expect(page.endPlanOpen()).toBe(false);
  });

  it('opens the status sheet from the ⋯ verbs', () => {
    const { page } = setup();
    page.openOptions(row(ProgramAssignmentStatus.Paused));
    page.onOption('changeStatus');
    expect(page.endPlanOpen()).toBe(true);
  });

  it('goes straight to the status sheet when the copy cannot change', () => {
    const { page } = setup();
    page.openOptions(row(ProgramAssignmentStatus.Pending));
    expect(page.optionsOpen()).toBe(false);
    expect(page.endPlanOpen()).toBe(true);
  });
});
