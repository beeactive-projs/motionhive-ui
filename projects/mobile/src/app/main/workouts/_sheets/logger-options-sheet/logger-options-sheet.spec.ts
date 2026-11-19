import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoggerOptionId, LoggerOptionIds, LoggerOptionsSheet } from './logger-options-sheet';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.overrideComponent(LoggerOptionsSheet, { set: { template: '', imports: [] } });
});

/** The ⋯ open on a workout whose rest for every exercise is `restForAll`. */
function setup(restForAll = 90) {
  const fixture = TestBed.createComponent(LoggerOptionsSheet);
  fixture.componentRef.setInput('prefs', { sound: true, vibration: true, askEffort: false });
  fixture.componentRef.setInput('restForAll', restForAll);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  const sheet = fixture.componentInstance;
  const rests: number[] = [];
  sheet.restChange.subscribe((seconds) => rests.push(seconds));
  return { sheet, rests };
}

describe('LoggerOptionsSheet', () => {
  it('shows the rest for every exercise as a clock', () => {
    expect(setup(90).sheet.restLabel()).toBe('1:30');
  });

  // Each tap applies at once, so there is nothing to confirm and the sheet stays.
  it('steps the rest 15 seconds a tap, from the one in use', () => {
    const { sheet, rests } = setup(90);
    sheet.nudge(1);
    sheet.nudge(-1);

    expect(rests).toEqual([105, 75]);
    expect(sheet.open()).toBe(true);
  });

  it('stops at the shortest rest', () => {
    const { sheet, rests } = setup(15);
    sheet.nudge(-1);

    expect(rests).toEqual([15]);
  });

  it('applies a preset as it is tapped', () => {
    const { sheet, rests } = setup(90);
    sheet.pickRest(180);

    expect(rests).toEqual([180]);
    expect(sheet.open()).toBe(true);
  });

  it('closes on a verb and says which', () => {
    const { sheet } = setup();
    const chosen: LoggerOptionId[] = [];
    sheet.chosen.subscribe((id) => chosen.push(id));
    sheet.choose(LoggerOptionIds.AddExercises);

    expect(chosen).toEqual([LoggerOptionIds.AddExercises]);
    expect(sheet.open()).toBe(false);
  });
});
