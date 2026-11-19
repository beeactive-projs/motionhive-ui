import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseKind } from 'core';

import { ExerciseRow } from './exercise-row';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseRow, { set: { template: '', imports: [] } });
});

describe('ExerciseRow', () => {
  // Compact wherever it is hosted: the picker and a workout's overview both
  // get the smaller type from the one class.
  it('is a compact row', () => {
    const fixture = TestBed.createComponent(ExerciseRow);
    fixture.componentRef.setInput('exercise', {
      id: 'e1',
      name: 'Plank',
      kind: ExerciseKind.Strength,
      thumbnailUrl: null,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList.contains('mh-compact-row')).toBe(true);
  });
});
