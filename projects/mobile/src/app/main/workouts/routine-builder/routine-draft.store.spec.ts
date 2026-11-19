import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AuthStore } from 'core';

import { ParkedDraft, RoutineDraftStore } from './routine-draft.store';

function draft(name: string): ParkedDraft {
  return { name, notes: '', defaultRest: null, exercises: [], editMode: false, keySeq: 4 };
}

function setup() {
  const user = signal<{ id: string } | null>({ id: 'ana' });
  TestBed.configureTestingModule({
    providers: [{ provide: AuthStore, useValue: { user } }],
  });
  return { store: TestBed.inject(RoutineDraftStore), user };
}

describe('RoutineDraftStore', () => {
  it('hands a parked draft back once', () => {
    const { store } = setup();

    store.park('/tabs/workouts/routine/new', draft('Leg day'));

    expect(store.take('/tabs/workouts/routine/new')?.name).toBe('Leg day');
    expect(store.take('/tabs/workouts/routine/new')).toBeNull();
  });

  it('keeps a draft to the tab it was left in', () => {
    const { store } = setup();

    store.park('/tabs/workouts/routine/new', draft('Leg day'));

    expect(store.take('/tabs/programs/routine/new')).toBeNull();
    expect(store.take('/tabs/workouts/routine/new')).not.toBeNull();
  });

  // Signing out and in as someone else, without a restart, must not hand them
  // the last person's routine.
  it('keeps a draft to the account that left it', () => {
    const { store, user } = setup();
    store.park('/tabs/workouts/routine/new', draft('Leg day'));

    user.set({ id: 'bob' });
    expect(store.take('/tabs/workouts/routine/new')).toBeNull();

    user.set({ id: 'ana' });
    expect(store.take('/tabs/workouts/routine/new')?.name).toBe('Leg day');
  });
});
