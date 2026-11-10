import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseKind } from 'core';

import { kindIcon, kindTone } from '../../../exercises/exercises.config';
import { ExerciseCard } from './exercise-card';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseCard, { set: { template: '', imports: [] } });
});

function card(kind: ExerciseKind | null, imageUrl: string | null): ExerciseCard {
  const fixture = TestBed.createComponent(ExerciseCard);
  fixture.componentRef.setInput('name', 'Back squat');
  fixture.componentRef.setInput('kind', kind);
  fixture.componentRef.setInput('imageUrl', imageUrl);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ExerciseCard tile', () => {
  it("draws the kind's glyph when there is no photo", () => {
    expect(card(ExerciseKind.Strength, null).tile()).toEqual({
      icon: kindIcon(ExerciseKind.Strength),
      tone: kindTone(ExerciseKind.Strength),
      imageUrl: null,
    });
  });

  // The kind's tint stays under the photo, so one that fails to load still
  // reads as an exercise of that kind.
  it("draws the photo over the kind's tint", () => {
    expect(card(ExerciseKind.Cardio, 'https://cdn/row.jpg').tile()).toEqual({
      icon: null,
      tone: kindTone(ExerciseKind.Cardio),
      imageUrl: 'https://cdn/row.jpg',
    });
  });

  it('draws a photo with no kind on the neutral tint', () => {
    expect(card(null, 'https://cdn/row.jpg').tile()).toEqual({
      icon: null,
      tone: 'medium',
      imageUrl: 'https://cdn/row.jpg',
    });
  });

  it('draws no tile with neither, an empty address counting as none', () => {
    expect(card(null, null).tile()).toBeNull();
    expect(card(null, '').tile()).toBeNull();
  });
});
