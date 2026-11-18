import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SetField, SetFields } from 'core';

import { SetTableHead, fieldHeadingKey } from './set-table-head';

// The template blanked (Ionic does not render in jsdom), once per test:
// TestBed refuses an override after the first component is created.
beforeEach(() => {
  TestBed.overrideComponent(SetTableHead, { set: { template: '', imports: [] } });
});

function head(fields: readonly SetField[], unilateral = false): SetTableHead {
  const fixture = TestBed.createComponent(SetTableHead);
  fixture.componentRef.setInput('fields', fields);
  fixture.componentRef.setInput('unilateral', unilateral);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('SetTableHead', () => {
  it('heads each field column in the order the rows draw them', () => {
    expect(head([SetFields.Weight, SetFields.Reps]).labels()).toEqual([
      'workouts.logger.gridHead.weight',
      'workouts.logger.gridHead.reps',
    ]);
    expect(head([SetFields.Distance, SetFields.Duration]).labels()).toEqual([
      'workouts.logger.gridHead.distance',
      'workouts.logger.gridHead.time',
    ]);
  });

  // Split squats and single-arm work count each side, and the heading says so.
  it('heads reps as per side on a one-sided exercise', () => {
    expect(head([SetFields.Weight, SetFields.Reps], true).labels()).toEqual([
      'workouts.logger.gridHead.weight',
      'workouts.logger.gridHead.repsEach',
    ]);
  });

  // A superset round's cells name themselves in the same words (2026-11-18).
  it('shares its words with the cells of a row that has no heading', () => {
    expect(fieldHeadingKey(SetFields.Weight, false)).toBe('workouts.logger.gridHead.weight');
    expect(fieldHeadingKey(SetFields.Reps, true)).toBe('workouts.logger.gridHead.repsEach');
    expect(fieldHeadingKey(SetFields.Duration, true)).toBe('workouts.logger.gridHead.time');
  });

  // The routine builder's sets have nothing to tick, so no Done heading.
  it('heads the tick column unless the rows have none', () => {
    expect(head([SetFields.Reps]).tickable()).toBe(true);

    const fixture = TestBed.createComponent(SetTableHead);
    fixture.componentRef.setInput('fields', [SetFields.Reps]);
    fixture.componentRef.setInput('tickable', false);
    fixture.detectChanges();
    expect(fixture.componentInstance.tickable()).toBe(false);
    expect(fixture.componentInstance.labels()).toEqual(['workouts.logger.gridHead.reps']);
  });
});
