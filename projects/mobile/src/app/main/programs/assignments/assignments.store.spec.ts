import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ProgramAssignmentService, ProgramService } from 'core';

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
});
