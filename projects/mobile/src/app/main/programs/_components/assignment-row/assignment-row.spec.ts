import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { AssignmentRow } from './assignment-row';

function row(status: ProgramAssignmentStatus): ProgramAssignment {
  return {
    id: 'a-1',
    clientId: 'c-1',
    programNameSnapshot: 'Strength Base',
    status,
    startDate: '2026-11-02',
    completionPercent: 42,
    client: { id: 'c-1', firstName: 'Anna', lastName: 'Popescu', avatarUrl: null, handle: null },
  } as ProgramAssignment;
}

describe('AssignmentRow', () => {
  function setup(status: ProgramAssignmentStatus) {
    TestBed.overrideComponent(AssignmentRow, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: Record<string, unknown>) => {
              if (params?.['name']) {
                return `${key}:${params['name']}`;
              }
              return key;
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AssignmentRow);
    fixture.componentRef.setInput('assignment', row(status));
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens the plan sheet from a running plan, which no longer pauses in one tap', () => {
    const instance = setup(ProgramAssignmentStatus.Active);
    expect(instance.canChange()).toBe(true);
    expect(instance.canResume()).toBe(false);
    expect(instance.optionsLabel()).toBe('programs.endPlan.options:Anna Popescu');
  });

  it('keeps Resume as a direct verb on a paused plan, with the sheet beside it', () => {
    const instance = setup(ProgramAssignmentStatus.Paused);
    expect(instance.canResume()).toBe(true);
    expect(instance.canChange()).toBe(true);
  });

  it('offers nothing on a record', () => {
    expect(setup(ProgramAssignmentStatus.Cancelled).canChange()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(ProgramAssignmentStatus.Completed).canChange()).toBe(false);
  });
});
