import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ClientService,
  InstructorClient,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramService,
} from 'core';

import { AssignSheet } from './assign-sheet';
import { firstWeekOf, lastDayOf, otherPlanNote, runningPlansOf } from './assign.config';

function active(n: number): InstructorClient {
  return {
    id: `rel-${n}`,
    clientId: `client-${n}`,
    status: 'ACTIVE',
    client: { id: `client-${n}`, firstName: `Name${n}`, lastName: '' },
  } as unknown as InstructorClient;
}

/** An invitation the coach sent; with no `client`, to an address with no account. */
function invited(id: string, fields: Record<string, unknown> = {}): InstructorClient {
  return {
    id,
    clientId: null,
    status: 'PENDING',
    requestType: 'INSTRUCTOR_TO_CLIENT',
    invitedEmail: `${id}@example.com`,
    client: null,
    ...fields,
  } as unknown as InstructorClient;
}

/** 150 active clients, served 100 to a page as the API does, and the invitations. */
function roster(invitations: InstructorClient[]) {
  const all = Array.from({ length: 150 }, (_, i) => active(i + 1));
  return vi.fn((params: { status: string; page?: number; limit: number }) => {
    if (params.status === 'PENDING') {
      return of({ items: invitations, total: invitations.length });
    }
    const start = ((params.page ?? 1) - 1) * params.limit;
    return of({ items: all.slice(start, start + params.limit), total: all.length });
  });
}

function setup(
  opts: {
    invitations?: InstructorClient[];
    otherPlans?: Partial<ProgramAssignment>[];
    workouts?: { name: string; weekIndex: number; dayIndex: number }[];
  } = {},
) {
  const getClients = roster(opts.invitations ?? []);
  const listForInstructor = vi.fn(() =>
    of({ items: opts.otherPlans ?? [], total: 0, page: 1, pageSize: 100 }),
  );
  const navigate = vi.fn(() => Promise.resolve(true));
  TestBed.overrideComponent(AssignSheet, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: ClientService, useValue: { getClients } },
      { provide: ProgramService, useValue: { list: () => of({ items: [], total: 0 }) } },
      { provide: ProgramAssignmentService, useValue: { listForInstructor } },
      { provide: Router, useValue: { url: '/tabs/programs/p-1/assignments', navigate } },
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
  const fixture = TestBed.createComponent(AssignSheet);
  fixture.componentRef.setInput('program', {
    id: 'p-1',
    name: 'Strength',
    workouts: opts.workouts ?? [],
  });
  fixture.componentInstance.open.set(true);
  fixture.detectChanges();
  return { fixture, sheet: fixture.componentInstance, getClients, listForInstructor, navigate };
}

describe('AssignSheet, picking the client', () => {
  it('lists every active client, page after page, not the 20 newest rows', () => {
    const { sheet, getClients } = setup();

    const activeCalls = getClients.mock.calls.filter((call) => call[0].status === 'ACTIVE');
    expect(activeCalls).toHaveLength(2);
    expect(activeCalls[0]).toEqual([{ status: 'ACTIVE', page: 1, limit: 100 }, { silent: true }]);
    expect(activeCalls[1][0]).toMatchObject({ page: 2 });
    expect(sheet.clients()).toHaveLength(150);
  });

  it('narrows the list by the name typed', () => {
    const { sheet } = setup();
    expect(sheet.showClientSearch()).toBe(true);

    sheet.clientQuery.set('name149');

    expect(sheet.visibleClients().map((row) => row.clientId)).toEqual(['client-149']);
  });

  it('never offers a start before today', () => {
    const { sheet } = setup();
    expect(sheet.minStartDate).toBe(sheet.startDate());
  });

  it('shows the invitations not accepted yet, an address with no account by that address', () => {
    const { sheet, getClients } = setup({
      invitations: [
        invited('inv-1'),
        invited('inv-2', {
          clientId: 'u-9',
          client: { id: 'u-9', firstName: 'Mihai', lastName: 'Ionescu' },
        }),
        // An incoming request is not an invitation; an old API might send one.
        invited('req-1', { requestType: 'CLIENT_TO_INSTRUCTOR' }),
      ],
    });

    expect(getClients).toHaveBeenCalledWith(
      { status: 'PENDING', direction: 'outgoing', limit: 100 },
      { silent: true },
    );
    expect(sheet.invitees().map((row) => row.id)).toEqual(['inv-1', 'inv-2']);
    expect(sheet.inviteeName(sheet.invitees()[0])).toBe('inv-1@example.com');
    expect(sheet.inviteeName(sheet.invitees()[1])).toBe('Mihai Ionescu');
    expect(sheet.isEmailOnly(sheet.invitees()[0])).toBe(true);
  });

  it('names the client on the button once one is picked', () => {
    const { sheet } = setup();
    expect(sheet.saveLabel()).toBe('programs.assign.assign');

    sheet.clientId.set('client-3');

    expect(sheet.saveLabel()).toBe('programs.assign.assignTo:Name3');
  });
});

describe('AssignSheet, the client already on a plan', () => {
  it("asks for the picked client's plans and warns about one still running", () => {
    const { sheet, fixture, listForInstructor } = setup({
      otherPlans: [
        {
          id: 'a-9',
          programNameSnapshot: 'Return to running',
          status: 'ACTIVE',
          startDate: '2026-11-02',
          endDate: '2026-12-13',
          completionPercent: 30,
        } as unknown as ProgramAssignment,
        { id: 'a-8', programNameSnapshot: 'Old', status: 'CANCELLED' } as unknown as ProgramAssignment,
      ],
    });

    sheet.clientId.set('client-3');
    fixture.detectChanges();

    expect(listForInstructor).toHaveBeenCalledWith(
      { clientId: 'client-3', limit: 100 },
      { silent: true },
    );
    expect(sheet.otherPlans().map((row) => row.id)).toEqual(['a-9']);
    expect(sheet.otherPlanNote()).toContain('Return to running');
  });

  it("opens that client's Training tab, after the sheet has closed", async () => {
    const { sheet, fixture, navigate } = setup();
    sheet.clientId.set('client-3');
    fixture.detectChanges();

    await sheet.seeOtherPlan();

    expect(navigate).toHaveBeenCalledWith(['/tabs/programs', 'client', 'client-3'], {
      queryParams: { tab: 'training' },
    });
  });
});

describe('AssignSheet, the first week and the last day', () => {
  it('lists the first week against dates and says when the plan ends', () => {
    const { sheet } = setup({
      workouts: [
        { name: 'Push A', weekIndex: 0, dayIndex: 0 },
        { name: 'Pull A', weekIndex: 0, dayIndex: 2 },
        { name: 'Push B', weekIndex: 1, dayIndex: 0 },
      ],
    });
    sheet.startDate.set('2026-11-23');

    expect(sheet.firstWeek().map((row) => row.name)).toEqual(['Push A', 'Pull A']);
    expect(sheet.lastDay()).toBe('programs.assign.lastDay');
  });
});

describe('assign config', () => {
  const day = (name: string, weekIndex: number, iso: string) => ({
    name,
    weekIndex,
    date: new Date(`${iso}T00:00:00`),
  });

  it('keeps the first program week, in date order, and finds the last day', () => {
    const days = [day('B', 0, '2026-11-25'), day('A', 0, '2026-11-23'), day('C', 1, '2026-12-02')];
    expect(firstWeekOf(days).map((d) => d.name)).toEqual(['A', 'B']);
    expect(lastDayOf(days)?.getDate()).toBe(2);
    expect(lastDayOf([])).toBeNull();
  });

  it('counts only the plans running or waiting', () => {
    const rows = [
      { status: 'ACTIVE' },
      { status: 'PENDING' },
      { status: 'PAUSED' },
      { status: 'COMPLETED' },
    ] as unknown as ProgramAssignment[];
    expect(runningPlansOf(rows)).toHaveLength(2);
  });

  it('says how many other plans when there are several', () => {
    const rows = [{ status: 'ACTIVE' }, { status: 'ACTIVE' }] as unknown as ProgramAssignment[];
    expect(otherPlanNote('Elena', rows, new Date())).toBe(
      "Elena already follows 2 other plans of yours. They'll have them all at the same time.",
    );
    expect(otherPlanNote('Elena', [], new Date())).toBeNull();
  });

  it('names the one other plan and where the client is in it', () => {
    const rows = [
      {
        id: 'a-1',
        programNameSnapshot: 'Return to running',
        status: 'ACTIVE',
        startDate: '2026-11-02',
        endDate: '2026-12-13',
        completionPercent: 30,
      },
    ] as unknown as ProgramAssignment[];
    expect(otherPlanNote('Elena', rows, new Date(2026, 10, 18))).toBe(
      "Elena already follows Return to running (week 3 of 6). They'll have both at the same time.",
    );
  });
});
