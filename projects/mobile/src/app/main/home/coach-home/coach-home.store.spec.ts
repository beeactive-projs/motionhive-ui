import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ClientService,
  ListInstancesQuery,
  ProfileService,
  ProgramAssignmentService,
  ProgramService,
  RosterService,
  SessionInstance,
  SessionService,
} from 'core';

import { CoachHomeStore } from './coach-home.store';

function setup(items: Partial<SessionInstance>[]) {
  const listInstances = vi.fn((_query: ListInstancesQuery, _opts?: { silent?: boolean }) =>
    of({ items: items as SessionInstance[], total: items.length, page: 1, pageSize: 10 }),
  );
  TestBed.configureTestingModule({
    providers: [
      CoachHomeStore,
      {
        provide: RosterService,
        useValue: {
          roster: () => of({ clients: [{ id: 'c-1' }] }),
          activity: () => of([]),
        },
      },
      {
        provide: ProgramAssignmentService,
        useValue: { listForInstructor: () => of({ items: [], total: 0 }) },
      },
      { provide: SessionService, useValue: { listInstances } },
      { provide: ClientService, useValue: { getPendingRequestsCount: () => of({ incoming: 0 }) } },
      { provide: ProgramService, useValue: { list: () => of({ items: [], total: 0 }) } },
      { provide: ProfileService, useValue: { getMyProfile: () => of(null) } },
    ],
  });
  return { store: TestBed.inject(CoachHomeStore), listInstances };
}

describe('CoachHomeStore, the Today row', () => {
  // The API moves a session to IN_PROGRESS a few minutes after it starts:
  // asking for SCHEDULED alone dropped a 09:00 class off the row at 09:05.
  it('reads the whole day, started and finished sessions included, cancelled left out', () => {
    const { store, listInstances } = setup([
      { id: 'done', status: 'COMPLETED' },
      { id: 'live', status: 'IN_PROGRESS' },
    ]);
    store.load();

    const [query, opts] = listInstances.mock.calls[0];
    expect(query.status).toEqual(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']);
    expect(query.limit).toBe(10);
    expect(opts).toEqual({ silent: true });

    const from = new Date(query.dateFrom ?? '');
    const to = new Date(query.dateTo ?? '');
    expect(from.getHours()).toBe(0);
    expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(23 * 3_600_000);

    expect(store.agenda().map((instance) => instance.id)).toEqual(['done', 'live']);
  });
});
