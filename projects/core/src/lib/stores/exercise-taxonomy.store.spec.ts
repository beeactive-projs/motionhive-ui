import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { Equipment } from '../models/exercise/equipment.model';
import type { Muscle } from '../models/exercise/muscle.model';
import { ExerciseService } from '../services/exercise/exercise.service';
import { ExerciseTaxonomyStore } from './exercise-taxonomy.store';

const chest = { id: 'm-chest', slug: 'chest' } as Muscle;
const barbell = { id: 'eq-barbell', slug: 'barbell' } as Equipment;

/** The store, with each muscles read answered by the next of `muscleReplies`. */
function setup(...muscleReplies: (() => Observable<Muscle[]>)[]) {
  const listMuscles = vi.fn(() => (muscleReplies.shift() ?? (() => of([chest])))());
  const listEquipment = vi.fn(() => of([barbell]));
  TestBed.configureTestingModule({
    providers: [{ provide: ExerciseService, useValue: { listMuscles, listEquipment } }],
  });
  return { store: TestBed.inject(ExerciseTaxonomyStore), listMuscles };
}

describe('ExerciseTaxonomyStore', () => {
  it('loads both lists once, however often it is asked', () => {
    const { store, listMuscles } = setup();

    store.ensureLoaded();
    store.ensureLoaded();

    expect(listMuscles).toHaveBeenCalledOnce();
    expect(store.muscles()).toEqual([chest]);
    expect(store.equipment()).toEqual([barbell]);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('shares a load still on its way', () => {
    const reply = new Subject<Muscle[]>();
    const { store, listMuscles } = setup(() => reply);

    store.ensureLoaded();
    store.ensureLoaded();
    expect(store.loading()).toBe(true);

    reply.next([chest]);
    reply.complete();
    expect(listMuscles).toHaveBeenCalledOnce();
    expect(store.loaded()).toBe(true);
  });

  // One failed load (no signal in the gym) left `loading` set for good, so
  // every later call returned early and the picker's muscle chips never came.
  it('tries again on the next call after a failed load', () => {
    const { store, listMuscles } = setup(() => throwError(() => new Error('offline')));

    store.ensureLoaded();
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.muscles()).toEqual([]);

    store.ensureLoaded();
    expect(listMuscles).toHaveBeenCalledTimes(2);
    expect(store.muscles()).toEqual([chest]);
  });
});
