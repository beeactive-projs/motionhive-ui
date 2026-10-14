import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Program, ProgramService, ProgramSource } from 'core';

import { ProgramOrigins } from './programs.config';
import { ProgramsStore } from './programs.store';

function program(id: string, source: Program['source']): Program {
  return {
    id,
    name: id,
    source,
    isSingleWorkout: true,
    updatedAt: '2026-10-01T00:00:00Z',
  } as Program;
}

function setup(rows: Program[]): ProgramsStore {
  const list = vi.fn(() => of({ items: rows, total: rows.length, page: 1, pageSize: 50 }));
  TestBed.configureTestingModule({
    providers: [ProgramsStore, { provide: ProgramService, useValue: { list } }],
  });
  const store = TestBed.inject(ProgramsStore);
  store.load();
  return store;
}

describe('ProgramsStore — whose programs', () => {
  it('opens on the coach\'s own work, starters one pill away', () => {
    const store = setup([
      program('mine-1', ProgramSource.Instructor),
      program('starter-1', ProgramSource.System),
    ]);

    expect(store.origin()).toBe(ProgramOrigins.Mine);
    expect(store.visible().map((p) => p.id)).toEqual(['mine-1']);

    store.setOrigin(ProgramOrigins.Starters);
    expect(store.visible().map((p) => p.id)).toEqual(['starter-1']);
  });

  it('shows everything while the coach has nothing of their own', () => {
    // "Mine" on an empty list beside ten starters would read as broken.
    const store = setup([program('starter-1', ProgramSource.System)]);

    expect(store.visible().map((p) => p.id)).toEqual(['starter-1']);
  });
});
