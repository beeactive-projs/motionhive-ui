import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { InfiniteScrollCustomEvent } from '@ionic/angular/standalone';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppModeStore,
  AuthStore,
  Exercise,
  ExerciseOwnershipFilter,
  ExerciseTaxonomyStore,
} from 'core';

import { ExercisesStore } from '../../exercises.store';
import { ExerciseLibrary } from './exercise-library';

const mine = { id: 'e-mine', name: 'My curl', ownerId: 'me' } as Exercise;
const theirs = { id: 'e-theirs', name: 'Their curl', ownerId: 'someone' } as Exercise;
const system = { id: 'e-system', name: 'Plank', ownerId: null } as unknown as Exercise;

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseLibrary, { set: { template: '', imports: [] } });
});

function setup(options: { coachMode?: boolean } = {}) {
  const ownership = signal<ExerciseOwnershipFilter>(ExerciseOwnershipFilter.All);
  const store = {
    ownership,
    search: signal(''),
    total: signal(0),
    sort: signal(undefined),
    hasNarrowing: signal(false),
    isFilteredEmpty: signal(false),
    loadMore: vi.fn(),
    refresh: vi.fn(),
  };
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ExercisesStore, useValue: store },
      {
        provide: AuthStore,
        useValue: { isInstructor: signal(!!options.coachMode), user: signal({ id: 'me' }) },
      },
      { provide: AppModeStore, useValue: { isCoach: signal(!!options.coachMode) } },
      { provide: ExerciseTaxonomyStore, useValue: { ensureLoaded: vi.fn() } },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(ExerciseLibrary);
  fixture.componentRef.setInput('detailBase', ['/tabs/workouts/exercise']);
  fixture.detectChanges();
  return { library: fixture.componentInstance, store, router, ownership };
}

describe('ExerciseLibrary', () => {
  // The library page's swipe, on the rows the short form can edit.
  it('swipes only your own exercises', () => {
    const { library } = setup();
    expect(library.isSwipeable(mine)).toBe(true);
    expect(library.isSwipeable(theirs)).toBe(false);
    expect(library.isSwipeable(system)).toBe(false);
  });

  // A coach in coach mode edits from the library page, with the full form.
  it('swipes nothing in coach mode', () => {
    const { library } = setup({ coachMode: true });
    expect(library.isSwipeable(mine)).toBe(false);
  });

  // A one-owner slice would repeat the same badge on every row.
  it('says whose a row is on All only', () => {
    const { library, ownership } = setup();
    expect(library.onAll()).toBe(true);
    ownership.set(ExerciseOwnershipFilter.Mine);
    expect(library.onAll()).toBe(false);
  });

  it('loads the next page as the list end comes up, then lets the scroll go', () => {
    const { library, store } = setup();
    const complete = vi.fn(() => Promise.resolve());
    library.onLoadMore({ target: { complete } } as unknown as InfiniteScrollCustomEvent);
    expect(store.loadMore).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    store.loadMore.mock.calls[0][0]();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("opens an exercise in the host's stack", () => {
    const { library, router } = setup();
    library.open(mine);
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/workouts/exercise', 'e-mine']);
  });
});
