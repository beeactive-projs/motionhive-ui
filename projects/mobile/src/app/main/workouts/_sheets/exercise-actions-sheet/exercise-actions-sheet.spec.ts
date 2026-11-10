import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoggedExercise } from 'core';

import { ExerciseActionIds } from '../../workouts.config';
import { ExerciseActionsSheet } from './exercise-actions-sheet';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(ExerciseActionsSheet, { set: { template: '', imports: [] } });
});

const squat = {
  id: 'le-1',
  exerciseId: 'ex-squat',
  exerciseNameSnapshot: 'Back squat',
  isSkipped: false,
  personalNote: null,
} as unknown as LoggedExercise;

function sheet(canCollapse: boolean): ExerciseActionsSheet {
  const fixture = TestBed.createComponent(ExerciseActionsSheet);
  fixture.componentRef.setInput('exercise', squat);
  fixture.componentRef.setInput('canCollapse', canCollapse);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ExerciseActionsSheet', () => {
  // The logger knows whether the exercise is done and open again; the sheet
  // leads with Collapse only then.
  it('leads with Collapse while the logger says the exercise can fold', () => {
    expect(sheet(true).actions()[0].id).toBe(ExerciseActionIds.Collapse);
    expect(sheet(false).actions().map((action) => action.id)).not.toContain(
      ExerciseActionIds.Collapse,
    );
  });
});
