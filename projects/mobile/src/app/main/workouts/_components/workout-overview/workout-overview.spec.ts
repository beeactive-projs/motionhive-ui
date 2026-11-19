import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseKind } from 'core';

import { OverviewExercise, WorkoutOverview } from './workout-overview';

const squat: OverviewExercise = {
  key: 'pe-1',
  exercise: { id: 'squat', name: 'Back squat', kind: ExerciseKind.Strength, thumbnailUrl: null },
  prescription: '4 sets · 5–8 reps · 90 kg',
};

function build(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(WorkoutOverview);
  fixture.componentRef.setInput('title', 'Leg day');
  fixture.componentRef.setInput('exercises', [squat]);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('WorkoutOverview', () => {
  beforeEach(() => {
    TestBed.overrideComponent(WorkoutOverview, { set: { template: '', imports: [] } });
  });

  // A plan's day has no routine rest to show, and no meta until it loads.
  it('shows no meta line and no rest row unless the page gives them', () => {
    const overview = build();

    expect(overview.meta()).toBeNull();
    expect(overview.rest()).toBeNull();
  });

  it('takes the meta line and the rest as the page words them', () => {
    const overview = build({ meta: '6 exercises · 19 sets', rest: '1:30' });

    expect(overview.meta()).toBe('6 exercises · 19 sets');
    expect(overview.rest()).toBe('1:30');
  });

  it('opens and closes a long note', () => {
    const overview = build({ note: 'Heavy squats first, then accessories.' });

    overview.toggleNote();
    expect(overview.noteOpen()).toBe(true);
    overview.toggleNote();
    expect(overview.noteOpen()).toBe(false);
  });
});
