import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Exercise, ExerciseKind } from 'core';

import { ExerciseFlatRow } from './exercise-flat-row';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseFlatRow, { set: { template: '', imports: [] } });
});

describe('ExerciseFlatRow', () => {
  // The library's row matches the card list's `mh-exercise-row`: both are
  // compact, so the library and the picker read the same.
  it('is a compact row', () => {
    const fixture = TestBed.createComponent(ExerciseFlatRow);
    fixture.componentRef.setInput('exercise', {
      id: 'e1',
      name: 'Plank',
      kind: ExerciseKind.Strength,
      thumbnailUrl: null,
    } as Exercise);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList.contains('mh-compact-row')).toBe(true);
  });
});
