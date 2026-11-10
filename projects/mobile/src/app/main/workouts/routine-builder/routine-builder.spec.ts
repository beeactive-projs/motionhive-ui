import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { AppModeStore, AuthStore, RoutineService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { RoutineActionsService } from '../_services/routine-actions.service';
import { WorkoutSettingsStore } from '../_services/workout-settings.store';
import { RoutineBuilder } from './routine-builder';

type Row = Parameters<RoutineBuilder['targetText']>[1];

/** The builder with its template blanked (Ionic does not render in jsdom). */
function builder(): RoutineBuilder {
  const unused = [
    RoutineService,
    ActivatedRoute,
    Router,
    FeedbackService,
    ActiveWorkoutService,
    RoutineActionsService,
    AuthStore,
    AppModeStore,
    WorkoutSettingsStore,
  ];
  TestBed.configureTestingModule({
    providers: [
      ...unused.map((token) => ({ provide: token, useValue: {} })),
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(RoutineBuilder, { set: { template: '', imports: [] } });
  return TestBed.createComponent(RoutineBuilder).componentInstance;
}

const row = { targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 60 } as Row;

describe('RoutineBuilder.targetText', () => {
  it('shows each target as the routine holds it', () => {
    const page = builder();

    expect(page.targetText(0, row, page.Targets.Reps)).toBe('8-10');
    expect(page.targetText(0, row, page.Targets.Weight)).toBe('60');
  });

  it('keeps the value until the pad is touched, then shows what it builds', () => {
    const page = builder();
    page.editing.set({ index: 0, field: page.Targets.Reps });
    expect(page.targetText(0, row, page.Targets.Reps)).toBe('8-10');

    page.typed.set('12');
    expect(page.targetText(0, row, page.Targets.Reps)).toBe('12');
    // Only the target being typed into.
    expect(page.targetText(0, row, page.Targets.Weight)).toBe('60');
    expect(page.targetText(1, row, page.Targets.Reps)).toBe('8-10');
  });

  // Cleared on the pad, the target went on showing its old 8-10, so clearing
  // looked like it had done nothing.
  it('shows a dash once the pad is cleared', () => {
    const page = builder();
    page.editing.set({ index: 0, field: page.Targets.Reps });
    page.typed.set('');

    expect(page.targetText(0, row, page.Targets.Reps)).toBe('–');
  });
});
