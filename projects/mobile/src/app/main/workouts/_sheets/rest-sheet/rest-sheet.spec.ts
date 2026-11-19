import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { RestChange, RestScopes, RestSheet } from './rest-sheet';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(RestSheet, { set: { template: '', imports: [] } });
});

/** The timer's sheet opened on the rest running now. */
function opened(seconds: number, exerciseName: string): RestSheet {
  const fixture = TestBed.createComponent(RestSheet);
  fixture.componentRef.setInput('seconds', seconds);
  fixture.componentRef.setInput('exerciseName', exerciseName);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('RestSheet', () => {
  // The sheet opens from the timer only now (the ⋯ sets the rest for every
  // exercise in place), so it starts on the exercise resting.
  it('opens on this exercise, with the rest running now', () => {
    const sheet = opened(120, 'Back squat');

    expect(sheet.scope()).toBe(RestScopes.Exercise);
    expect(sheet.display()).toBe('2:00');
  });

  it('opens on every exercise when no exercise is resting', () => {
    expect(opened(90, '').scope()).toBe(RestScopes.Workout);
  });

  it('steps 15 seconds a tap, between 0:15 and 10:00, and applies it on save', () => {
    const sheet = opened(600, 'Back squat');
    const applied: RestChange[] = [];
    sheet.apply.subscribe((change) => applied.push(change));

    sheet.nudge(1);
    expect(sheet.value()).toBe(600);
    sheet.nudge(-1);
    sheet.save();

    expect(applied).toEqual([{ seconds: 585, scope: RestScopes.Exercise }]);
    expect(sheet.open()).toBe(false);
  });
});
