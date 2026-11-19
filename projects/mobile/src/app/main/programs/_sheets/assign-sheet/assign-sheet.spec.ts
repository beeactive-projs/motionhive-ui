import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ClientService, InstructorClient, ProgramService } from 'core';

import { AssignSheet } from './assign-sheet';

function active(n: number): InstructorClient {
  return {
    id: `rel-${n}`,
    clientId: `client-${n}`,
    status: 'ACTIVE',
    client: { id: `client-${n}`, firstName: `Name${n}`, lastName: '' },
  } as unknown as InstructorClient;
}

/** 150 active clients, served 100 to a page as the API does. */
function roster() {
  const all = Array.from({ length: 150 }, (_, i) => active(i + 1));
  return vi.fn((params: { page: number; limit: number }) => {
    const start = (params.page - 1) * params.limit;
    return of({ items: all.slice(start, start + params.limit), total: all.length });
  });
}

function setup() {
  const getClients = roster();
  TestBed.overrideComponent(AssignSheet, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: ClientService, useValue: { getClients } },
      { provide: ProgramService, useValue: { list: () => of({ items: [], total: 0 }) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const fixture = TestBed.createComponent(AssignSheet);
  fixture.componentRef.setInput('program', { id: 'p-1', name: 'Strength', workouts: [] });
  fixture.componentInstance.open.set(true);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance, getClients };
}

describe('AssignSheet, picking the client', () => {
  it('lists every active client, page after page, not the 20 newest rows', () => {
    const { sheet, getClients } = setup();

    expect(getClients).toHaveBeenCalledTimes(2);
    expect(getClients).toHaveBeenNthCalledWith(
      1,
      { status: 'ACTIVE', page: 1, limit: 100 },
      { silent: true },
    );
    expect(getClients.mock.calls[1][0]).toMatchObject({ page: 2 });
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
});
