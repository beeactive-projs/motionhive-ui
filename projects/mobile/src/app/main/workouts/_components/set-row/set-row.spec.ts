import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseSetType, LoggedSet, SetField, SetFields } from 'core';

import { BadgeTones, SetRowModes } from '../../logger/logger-flow';
import { SetRow } from './set-row';

function set(partial: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: 's-1',
    loggedExerciseId: 'ex',
    assignedSetId: null,
    orderIndex: 0,
    setType: ExerciseSetType.Normal,
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    rir: null,
    restAfterSeconds: null,
    isCompleted: false,
    completedAt: null,
    notes: null,
    ...partial,
  };
}

const kgReps: SetField[] = [SetFields.Weight, SetFields.Reps];

// The template blanked (Ionic does not render in jsdom), once per test:
// TestBed refuses an override after the first component is created.
beforeEach(() => {
  TestBed.overrideComponent(SetRow, { set: { template: '', imports: [] } });
});

/** A row; `inputs` override the defaults. */
function row(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(SetRow);
  const all: Record<string, unknown> = {
    set: set(),
    mode: SetRowModes.Future,
    badge: { text: '1', name: 'Set 1', tone: BadgeTones.Plain },
    fields: kgReps,
    ...inputs,
  };
  for (const [name, value] of Object.entries(all)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.componentInstance;
}

const texts = (setRow: SetRow) => setRow.cells().map((cell) => [cell.text, cell.prefill]);

describe('SetRow', () => {
  it('shows what was typed, else the grey pre-fill', () => {
    const setRow = row({
      set: set({ reps: 10 }),
      prefill: { [SetFields.Weight]: 60, [SetFields.Reps]: 8 },
    });

    expect(texts(setRow)).toEqual([
      ['60', true],
      ['10', false],
    ]);
  });

  it('shows what the pad is building in the field being typed', () => {
    const setRow = row({
      prefill: { [SetFields.Reps]: 8 },
      editing: SetFields.Reps,
      draft: '12',
    });

    expect(setRow.cells()[1]).toMatchObject({ text: '12', prefill: false, active: true });
  });

  // Cleared on the pad, a field showed "–" while the tick still saved its
  // grey 8. Empty now looks like empty everywhere: the pre-fill the tick saves.
  it('shows the grey pre-fill in a field cleared on the pad', () => {
    const setRow = row({
      prefill: { [SetFields.Reps]: 8 },
      editing: SetFields.Reps,
      draft: '',
    });

    expect(setRow.cells()[1]).toMatchObject({ text: '8', prefill: true, active: true });
  });

  it('shows the pre-fill, not the old value, when a typed value is cleared', () => {
    const setRow = row({
      set: set({ reps: 10 }),
      prefill: { [SetFields.Reps]: 8 },
      editing: SetFields.Reps,
      draft: '',
    });

    expect(setRow.cells()[1]).toMatchObject({ text: '8', prefill: true });
  });

  it('shows a cleared field with no pre-fill as empty', () => {
    const setRow = row({ set: set({ reps: 10 }), editing: SetFields.Reps, draft: '' });

    expect(setRow.cells()[1]).toMatchObject({ text: '', prefill: true });
  });

  it('keeps the units out of the cells under a heading', () => {
    const setRow = row({ set: set({ weightKg: 60, reps: 8 }) });

    expect(setRow.cells().map((cell) => cell.unit)).toEqual([null, null]);
  });

  // A superset round has no heading over its columns: "62.5 | 8" has to say
  // which number is the weight.
  it('names the weight and distance units in a row with no heading', () => {
    const setRow = row({
      set: set({ weightKg: 62.5, reps: 8 }),
      units: true,
    });
    expect(setRow.cells().map((cell) => cell.unit)).toEqual(['workouts.units.kgShort', null]);

    const cardio = row({
      set: set({ distanceMeters: 400, durationSeconds: 105 }),
      fields: [SetFields.Distance, SetFields.Duration],
      units: true,
    });
    expect(cardio.cells().map((cell) => cell.unit)).toEqual(['workouts.units.metersShort', null]);
  });

  // 9999.99 kg clipped by a few pixels on an SE at 130% text: past six
  // characters a value steps down a size.
  it('marks a value past six characters as long', () => {
    const setRow = row({ set: set({ weightKg: 9999.99, reps: 8 }) });

    expect(setRow.cells().map((cell) => cell.long)).toEqual([true, false]);
  });

  it('names no unit on an empty cell', () => {
    const setRow = row({ units: true });

    expect(setRow.cells().map((cell) => cell.unit)).toEqual([null, null]);
  });
});
