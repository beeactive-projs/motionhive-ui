import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  ProgramService,
} from 'core';

import { AssignmentsStore } from './assignments.store';

describe('AssignmentsStore', () => {
  it("asks the API for this program's clients, not the newest across every program", () => {
    const listForInstructor = vi.fn(() =>
      of({
        items: [
          { id: 'a-1', masterProgramId: 'p-1' },
          // An API from before the filter could still send another program's row.
          { id: 'a-2', masterProgramId: 'p-2' },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        AssignmentsStore,
        { provide: ProgramAssignmentService, useValue: { listForInstructor } },
        { provide: ProgramService, useValue: { get: () => of({ id: 'p-1', name: 'Strength' }) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const store = TestBed.inject(AssignmentsStore);

    store.load('p-1');

    expect(listForInstructor).toHaveBeenCalledWith({ programId: 'p-1', limit: 100 });
    expect(store.rows().map((row) => row.id)).toEqual(['a-1']);
  });

  it("sends the coach's message with a status change, and keeps the client on the row", () => {
    const row = {
      id: 'a-1',
      masterProgramId: 'p-1',
      status: 'ACTIVE',
      client: { id: 'c-1', firstName: 'Anna' },
    };
    const update = vi.fn(() => of({ id: 'a-1', masterProgramId: 'p-1', status: 'PAUSED' }));
    TestBed.configureTestingModule({
      providers: [
        AssignmentsStore,
        {
          provide: ProgramAssignmentService,
          useValue: {
            listForInstructor: () => of({ items: [row], total: 1, page: 1, pageSize: 100 }),
            update,
          },
        },
        { provide: ProgramService, useValue: { get: () => of({ id: 'p-1', name: 'Strength' }) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const store = TestBed.inject(AssignmentsStore);
    store.load('p-1');
    const done = vi.fn();

    store.setStatus(store.rows()[0], ProgramAssignmentStatus.Paused, done, 'Vacanță');

    expect(update).toHaveBeenCalledWith('a-1', { status: 'PAUSED', message: 'Vacanță' });
    expect(done).toHaveBeenCalledWith();
    expect(store.rows()[0]).toMatchObject({ status: 'PAUSED', client: { firstName: 'Anna' } });
  });

  it('sends no message field when the coach wrote none', () => {
    const update = vi.fn(() => of({ id: 'a-1', status: 'ACTIVE' }));
    TestBed.configureTestingModule({
      providers: [
        AssignmentsStore,
        { provide: ProgramAssignmentService, useValue: { update } },
        { provide: ProgramService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const store = TestBed.inject(AssignmentsStore);

    store.setStatus(
      { id: 'a-1', status: 'PAUSED' } as unknown as ProgramAssignment,
      ProgramAssignmentStatus.Active,
      () => undefined,
    );

    expect(update).toHaveBeenCalledWith('a-1', { status: 'ACTIVE' });
  });
});
