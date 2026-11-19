import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseKind } from 'core';

import { kindIcon, kindTone } from '../../../exercises/exercises.config';
import { ExerciseHead } from './exercise-head';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseHead, { set: { template: '', imports: [] } });
});

function head(kind: ExerciseKind | null, imageUrl: string | null) {
  const fixture = TestBed.createComponent(ExerciseHead);
  fixture.componentRef.setInput('name', 'Back squat');
  fixture.componentRef.setInput('kind', kind);
  fixture.componentRef.setInput('imageUrl', imageUrl);
  fixture.detectChanges();
  return fixture;
}

describe('ExerciseHead tile', () => {
  it("draws the kind's glyph when there is no photo", () => {
    expect(head(ExerciseKind.Strength, null).componentInstance.tile()).toEqual({
      icon: kindIcon(ExerciseKind.Strength),
      tone: kindTone(ExerciseKind.Strength),
      imageUrl: null,
    });
  });

  // The kind's tint stays under the photo, so one that fails to load still
  // reads as an exercise of that kind.
  it("draws the photo over the kind's tint", () => {
    expect(head(ExerciseKind.Cardio, 'https://cdn/row.jpg').componentInstance.tile()).toEqual({
      icon: null,
      tone: kindTone(ExerciseKind.Cardio),
      imageUrl: 'https://cdn/row.jpg',
    });
  });

  it('draws a photo with no kind on the neutral tint', () => {
    expect(head(null, 'https://cdn/row.jpg').componentInstance.tile()).toEqual({
      icon: null,
      tone: 'medium',
      imageUrl: 'https://cdn/row.jpg',
    });
  });

  it('draws no tile with neither, an empty address counting as none', () => {
    expect(head(null, null).componentInstance.tile()).toBeNull();
    expect(head(null, '').componentInstance.tile()).toBeNull();
  });
});

describe('ExerciseHead skipped', () => {
  // The class strikes the name through (exercise-head.scss).
  it('marks its host while the exercise is skipped', () => {
    const fixture = head(ExerciseKind.Strength, null);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('skipped')).toBe(false);

    fixture.componentRef.setInput('skipped', true);
    fixture.detectChanges();

    expect(host.classList.contains('skipped')).toBe(true);
  });
});
