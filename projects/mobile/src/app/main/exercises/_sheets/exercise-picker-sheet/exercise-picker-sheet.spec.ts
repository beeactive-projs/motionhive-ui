import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Exercise, ExerciseService, ExerciseTaxonomyStore, Muscle } from 'core';

import { RecentExercisesStore } from '../../recent-exercises.store';
import { ExercisePickerSheet } from './exercise-picker-sheet';

const chest = { id: 'm-chest', slug: 'chest', commonName: 'Chest' } as Muscle;
const lats = { id: 'm-lats', slug: 'lats', commonName: 'Lats' } as Muscle;

type Page = { items: Exercise[]; total: number };
const empty = (): Observable<Page> => of({ items: [], total: 0 });
const offline = (): Observable<Page> => throwError(() => new Error('offline'));

/**
 * The sheet opened, its template blanked (Ionic does not render in jsdom),
 * with each catalogue read answered by the next of `replies`, then by an
 * empty page.
 */
function setup(...replies: (() => Observable<Page>)[]) {
  const list = vi.fn(() => (replies.shift() ?? empty)());
  const ensureLoaded = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ExerciseService, useValue: { list } },
      { provide: RecentExercisesStore, useValue: { exercises: signal([]), push: vi.fn() } },
      {
        provide: ExerciseTaxonomyStore,
        useValue: { muscles: signal([chest, lats]), ensureLoaded },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(ExercisePickerSheet, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ExercisePickerSheet);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  return { fixture, sheet: fixture.componentInstance, list, ensureLoaded };
}

describe('ExercisePickerSheet', () => {
  it('reads the catalogue once on opening', () => {
    const { list } = setup();

    expect(list).toHaveBeenCalledTimes(1);
  });

  // The muscle chips come from the taxonomy: a load that failed when the
  // sheet was built is tried again on the next opening, not never.
  it('asks for the muscles again on every opening', () => {
    const { fixture, ensureLoaded } = setup();
    const before = ensureLoaded.mock.calls.length;

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(ensureLoaded.mock.calls.length).toBe(before + 1);
  });

  // Chest, then "squat": nothing comes back because squats are not chest
  // work. Saying the name does not exist, and offering to make it, would save
  // a private duplicate of the catalogue's squat.
  it('blames the filter, not the name, when a filtered search finds nothing', () => {
    const { sheet } = setup();
    sheet.query.set('squat');
    sheet.pickMuscle(chest.id);

    expect(sheet.isSearching()).toBe(true);
    expect(sheet.isFiltering()).toBe(true);
    expect(sheet.isEmpty()).toBe(true);
    expect(sheet.emptyMessage()).toBe('exercises.picker.noFilterMatch');
    expect(sheet.canCreate()).toBe(false);
  });

  it('offers to create the name again once All clears the filter', () => {
    const { sheet } = setup();
    sheet.query.set('squat');
    sheet.pickMuscle(chest.id);
    sheet.pickMuscle(null);

    expect(sheet.isFiltering()).toBe(false);
    expect(sheet.emptyMessage()).toBe('exercises.picker.noMatch');
    expect(sheet.canCreate()).toBe(true);
  });

  it('says a filter found nothing with nothing typed too', () => {
    const { sheet } = setup();
    sheet.pickMuscle(lats.id);

    expect(sheet.emptyMessage()).toBe('exercises.picker.noFilterMatch');
  });

  it('says the catalogue could not be read, filter or not', () => {
    const { sheet } = setup(empty, offline);
    sheet.pickMuscle(chest.id);

    expect(sheet.emptyMessage()).toBe('exercises.picker.loadError');
    expect(sheet.canCreate()).toBe(false);
  });

  it('does nothing when the lit chip is tapped again', () => {
    const { sheet, list } = setup();
    sheet.pickMuscle(chest.id);
    sheet.pickMuscle(chest.id);
    sheet.pickMuscle(null);
    sheet.pickMuscle(null);

    // Opening, Chest, All: the repeat taps read nothing.
    expect(list).toHaveBeenCalledTimes(3);
  });

  // Offline, Chest fails; back online, the lit Chest is the way to try again.
  it('reads again when the lit chip is tapped after its read failed', () => {
    const { sheet, list } = setup(empty, offline);
    sheet.pickMuscle(chest.id);
    expect(sheet.emptyMessage()).toBe('exercises.picker.loadError');

    sheet.pickMuscle(chest.id);

    expect(list).toHaveBeenCalledTimes(3);
    expect(sheet.emptyMessage()).toBe('exercises.picker.noFilterMatch');
  });

  it('reads again when All is tapped after the opening read failed', () => {
    const squat = { id: 'e-squat', name: 'Squat' } as Exercise;
    const { sheet, list } = setup(offline, () => of({ items: [squat], total: 1 }));
    expect(sheet.isEmpty()).toBe(true);

    sheet.pickMuscle(null);

    expect(list).toHaveBeenCalledTimes(2);
    expect(sheet.rows()).toEqual([squat]);
  });
});
