import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, ExerciseKind, ExerciseService, ExerciseTaxonomyStore } from 'core';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { kindIcon } from '../../exercises.config';
import { ExerciseFormSheet } from './exercise-form-sheet';

/** The sheet opened on a new exercise, its template blanked (Ionic does not render in jsdom). */
function setup() {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: { isInstructor: signal(false) } },
      { provide: ExerciseService, useValue: {} },
      {
        provide: ExerciseTaxonomyStore,
        useValue: { muscles: signal([]), equipment: signal([]), ensureLoaded: vi.fn() },
      },
      { provide: FeedbackService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(ExerciseFormSheet, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ExerciseFormSheet);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  return { sheet: fixture.componentInstance };
}

describe('ExerciseFormSheet', () => {
  // A glyph and the words, nothing else: the tiles are the coach wizard's
  // pick tiles, where the honey of the picked one is the only colour.
  it('offers the four things the short form tracks, each with its glyph and words', () => {
    const { sheet } = setup();

    expect(sheet.trackTiles.map((tile) => ({ ...tile }))).toEqual([
      { value: ExerciseKind.Strength, icon: kindIcon(ExerciseKind.Strength), label: 'Weight and reps' },
      { value: ExerciseKind.Bodyweight, icon: kindIcon(ExerciseKind.Bodyweight), label: 'Reps only' },
      { value: ExerciseKind.Duration, icon: kindIcon(ExerciseKind.Duration), label: 'Time' },
      { value: ExerciseKind.Distance, icon: kindIcon(ExerciseKind.Distance), label: 'Distance' },
    ]);
  });

  it('starts a new exercise on weight and reps, and a tap moves the one pick', () => {
    const { sheet } = setup();

    expect(sheet.isKindOn(ExerciseKind.Strength)).toBe(true);

    sheet.selectKind(ExerciseKind.Duration);

    expect(sheet.isKindOn(ExerciseKind.Duration)).toBe(true);
    expect(sheet.isKindOn(ExerciseKind.Strength)).toBe(false);
  });
});
