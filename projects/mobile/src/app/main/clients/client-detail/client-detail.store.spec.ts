import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ClientService,
  InstructorClient,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  RosterService,
  SessionService,
  WorkoutLogService,
} from 'core';

import { ClientDetailStore } from './client-detail.store';

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

function setup(status: 'ACTIVE' | 'ARCHIVED') {
  const client = { id: 'rel-1', clientId: 'client-1', status } as unknown as InstructorClient;
  const listForClient = vi.fn(() => of(EMPTY_PAGE));
  const listForInstructor = vi.fn(() => of(EMPTY_PAGE));
  const roster = vi.fn(() => of({ clients: [] }));
  TestBed.configureTestingModule({
    providers: [
      ClientDetailStore,
      { provide: ClientService, useValue: { getClient: () => of(client) } },
      { provide: ProgramAssignmentService, useValue: { listForInstructor } },
      { provide: RosterService, useValue: { roster } },
      { provide: SessionService, useValue: { listInstances: () => of(EMPTY_PAGE) } },
      { provide: WorkoutLogService, useValue: { listForClient } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const store = TestBed.inject(ClientDetailStore);
  store.load('client-1');
  return { store, listForClient, listForInstructor, roster };
}

describe('ClientDetailStore', () => {
  it("reads an active client's training", () => {
    const { listForClient, listForInstructor, roster } = setup('ACTIVE');
    expect(listForClient).toHaveBeenCalled();
    expect(listForInstructor).toHaveBeenCalled();
    expect(roster).toHaveBeenCalled();
  });

  it("never asks for a former client's training, which is closed to the coach", () => {
    const { store, listForClient, listForInstructor, roster } = setup('ARCHIVED');
    expect(store.client()?.status).toBe('ARCHIVED');
    expect(listForClient).not.toHaveBeenCalled();
    expect(listForInstructor).not.toHaveBeenCalled();
    expect(roster).not.toHaveBeenCalled();
  });

  it("sends the coach's message with a plan's status change", () => {
    const client = { id: 'rel-1', clientId: 'client-1', status: 'ARCHIVED' } as unknown as InstructorClient;
    const update = vi.fn(() => of({ id: 'a-1', status: 'CANCELLED' }));
    TestBed.configureTestingModule({
      providers: [
        ClientDetailStore,
        { provide: ClientService, useValue: { getClient: () => of(client) } },
        { provide: ProgramAssignmentService, useValue: { update } },
        { provide: RosterService, useValue: { roster: () => of({ clients: [] }) } },
        { provide: SessionService, useValue: { listInstances: () => of(EMPTY_PAGE) } },
        { provide: WorkoutLogService, useValue: { listForClient: () => of(EMPTY_PAGE) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const store = TestBed.inject(ClientDetailStore);

    store
      .setPlanStatus(
        { id: 'a-1', status: 'ACTIVE' } as unknown as ProgramAssignment,
        ProgramAssignmentStatus.Cancelled,
        'Ne oprim aici.',
      )
      ?.subscribe();

    expect(update).toHaveBeenCalledWith('a-1', { status: 'CANCELLED', message: 'Ne oprim aici.' });
    expect(store.isPlanBusy('a-1')).toBe(false);
  });
});
