import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { EndPlanRequest, EndPlanSheet } from './end-plan-sheet';
import {
  EndPlanChoices,
  canChangePlan,
  endPlanChoices,
  endPlanClientName,
  endPlanStatus,
  endPlanSubtitle,
  isDestructiveChoice,
} from './end-plan.config';

function plan(fields: Partial<ProgramAssignment> = {}): ProgramAssignment {
  return {
    id: 'a-1',
    programNameSnapshot: 'Strength Base',
    status: ProgramAssignmentStatus.Active,
    startDate: '2026-11-02',
    endDate: '2026-12-27',
    completionPercent: 42,
    client: { id: 'c-1', firstName: 'Anna', lastName: 'Popescu', avatarUrl: null, handle: null },
    ...fields,
  } as ProgramAssignment;
}

describe('end plan config', () => {
  it('offers pause, finish and cancel on a running or waiting plan', () => {
    expect(endPlanChoices(ProgramAssignmentStatus.Active)).toEqual(['pause', 'finish', 'cancel']);
    expect(endPlanChoices(ProgramAssignmentStatus.Pending)).toEqual(['pause', 'finish', 'cancel']);
  });

  it('leaves Resume to the row on a paused plan', () => {
    expect(endPlanChoices(ProgramAssignmentStatus.Paused)).toEqual(['finish', 'cancel']);
  });

  it('offers nothing on a plan already finished or cancelled', () => {
    expect(canChangePlan(ProgramAssignmentStatus.Completed)).toBe(false);
    expect(canChangePlan(ProgramAssignmentStatus.Cancelled)).toBe(false);
    expect(canChangePlan(ProgramAssignmentStatus.Paused)).toBe(true);
  });

  it('sends the status each choice stands for, and only Cancel is red', () => {
    expect(endPlanStatus(EndPlanChoices.Pause)).toBe(ProgramAssignmentStatus.Paused);
    expect(endPlanStatus(EndPlanChoices.Finish)).toBe(ProgramAssignmentStatus.Completed);
    expect(endPlanStatus(EndPlanChoices.Cancel)).toBe(ProgramAssignmentStatus.Cancelled);
    expect(isDestructiveChoice(EndPlanChoices.Cancel)).toBe(true);
    expect(isDestructiveChoice(EndPlanChoices.Finish)).toBe(false);
  });

  it("talks about the client by first name, else what is there", () => {
    expect(endPlanClientName(plan(), 'Client')).toBe('Anna');
    expect(
      endPlanClientName(
        plan({ client: { id: 'c', firstName: '', lastName: 'Pop', avatarUrl: null, handle: null } }),
        'Client',
      ),
    ).toBe('Pop');
    expect(endPlanClientName(plan({ client: undefined }), 'Client')).toBe('Client');
  });

  it('says which plan, where the client is in it and how much is done', () => {
    expect(endPlanSubtitle(plan(), new Date(2026, 10, 18))).toBe(
      'Strength Base · Week 3 of 8 · 42% done',
    );
  });
});

describe('EndPlanSheet', () => {
  function setup(row: ProgramAssignment) {
    TestBed.overrideComponent(EndPlanSheet, { set: { template: '', imports: [] } });
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
    const fixture = TestBed.createComponent(EndPlanSheet);
    fixture.componentRef.setInput('assignment', row);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const sent: EndPlanRequest[] = [];
    fixture.componentInstance.confirm.subscribe((request) => sent.push(request));
    return { fixture, sheet: fixture.componentInstance, sent };
  }

  it('opens on the first choice, names the client and says they are told', () => {
    const { sheet } = setup(plan());
    expect(sheet.choice()).toBe('pause');
    expect(sheet.title()).toBe('programs.endPlan.title:Anna');
    expect(sheet.notice()).toBe('programs.endPlan.notice:Anna');
    expect(sheet.confirmLabel()).toBe('programs.endPlan.pause.confirm');
    expect(sheet.confirmColor()).toBe('primary');
  });

  it('turns the confirm red for Cancel and sends the trimmed message', () => {
    const { sheet, sent } = setup(plan());
    sheet.pick('cancel');
    sheet.message.set('  Ne vedem după vacanță.  ');

    expect(sheet.confirmColor()).toBe('danger');
    sheet.submit();

    expect(sent).toEqual([
      { status: ProgramAssignmentStatus.Cancelled, message: 'Ne vedem după vacanță.' },
    ]);
  });

  it('sends no message when none was written', () => {
    const { sheet, sent } = setup(plan());
    sheet.pick('finish');
    sheet.message.set('   ');
    sheet.submit();

    expect(sent).toEqual([{ status: ProgramAssignmentStatus.Completed }]);
  });

  it('refuses a choice the plan does not offer', () => {
    const { sheet } = setup(plan({ status: ProgramAssignmentStatus.Paused }));
    expect(sheet.choice()).toBe('finish');

    sheet.pick('pause');

    expect(sheet.choice()).toBe('finish');
  });

  it('clears the last message when it opens again', () => {
    const { fixture, sheet } = setup(plan());
    sheet.message.set('For Anna');
    sheet.open.set(false);
    fixture.detectChanges();
    sheet.open.set(true);
    fixture.detectChanges();

    expect(sheet.message()).toBe('');
  });
});
