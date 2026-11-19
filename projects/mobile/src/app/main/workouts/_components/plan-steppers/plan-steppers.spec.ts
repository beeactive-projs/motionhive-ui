import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExerciseKind, SetFields } from 'core';

import { DraftExercise, emptySet } from '../../routine-builder/routine-builder.config';
import { PlanStep, PlanSteppers, stepperLabelKey, stepperLabelWithUnit } from './plan-steppers';

const EMPTY = '–';

// The template blanked (Ionic does not render in jsdom), once per test.
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
  });
  TestBed.overrideComponent(PlanSteppers, { set: { template: '', imports: [] } });
});

function row(partial: Partial<DraftExercise> = {}): DraftExercise {
  return {
    key: 'row',
    exerciseId: 'squat',
    name: 'Back squat',
    kind: ExerciseKind.Strength,
    thumbnailUrl: null,
    unilateral: false,
    notes: null,
    supersetGroupId: null,
    addedWeight: false,
    perSet: false,
    sets: Array.from({ length: 3 }, (_, i) => ({ ...emptySet(`s${i}`), reps: 10, weightKg: 60 })),
    ...partial,
  };
}

function hold(): DraftExercise {
  return row({
    kind: ExerciseKind.Duration,
    sets: [{ ...emptySet('s'), durationSeconds: 45 }],
  });
}

function rows(exercise: DraftExercise, inputs: Record<string, unknown> = {}): PlanSteppers {
  const fixture = TestBed.createComponent(PlanSteppers);
  fixture.componentRef.setInput('exercise', exercise);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('PlanSteppers', () => {
  it('stacks Sets, Reps and Weight on a lift', () => {
    expect(rows(row()).steppers().map((s) => [s.label, s.value])).toEqual([
      ['workouts.routineBuilder.targets.sets', '3'],
      ['workouts.routineBuilder.targets.reps', '10'],
      ['workouts.routineBuilder.targets.weight', '60'],
    ]);
  });

  it('stacks Sets, Time and Weight on a hold', () => {
    expect(rows(hold()).steppers().map((s) => [s.label, s.value])).toEqual([
      ['workouts.routineBuilder.targets.sets', '1'],
      ['workouts.routineBuilder.targets.time', '0:45'],
      ['workouts.routineBuilder.targets.weight', EMPTY],
    ]);
  });

  it('shows a rep range as a range, and reps per side as such', () => {
    const range = row({ unilateral: true, sets: [{ ...emptySet('s'), reps: 8, repsMax: 12 }] });

    expect(rows(range).steppers()[1]).toMatchObject({
      label: 'workouts.routineBuilder.targets.repsEach',
      value: '8–12',
    });
    expect(stepperLabelKey({ unilateral: false }, SetFields.Weight)).toBe(
      'workouts.routineBuilder.targets.weight',
    );
  });

  it('cannot lower the sets below one, or a target below nothing', () => {
    const one = row({ sets: [{ ...emptySet('s'), reps: 10 }] });

    expect(rows(one).steppers().map((s) => s.canLower)).toEqual([false, true, false]);
  });

  it('echoes what the pad types into the row it types into', () => {
    const steppers = rows(row(), { active: SetFields.Reps, preview: '1' });
    const [sets, reps, weight] = steppers.steppers();

    expect(steppers.shown(reps)).toBe('1');
    expect(steppers.shown(weight)).toBe('60');
    expect(steppers.shown(sets)).toBe('3');
    expect(rows(row(), { active: SetFields.Reps, preview: '' }).shown(reps)).toBe(EMPTY);
  });

  it('marks only the row the pad types into, never Sets while the pad is closed', () => {
    const typing = rows(row(), { active: SetFields.Weight });
    const closed = rows(row());

    expect(typing.steppers().map((s) => typing.isActive(s))).toEqual([false, false, true]);
    expect(closed.steppers().map((s) => closed.isActive(s))).toEqual([false, false, false]);
  });

  it('reports a step and a value tap', () => {
    const steppers = rows(row());
    const steps: PlanStep[] = [];
    const edits: string[] = [];
    steppers.step.subscribe((s) => steps.push(s));
    steppers.edit.subscribe((f) => edits.push(f));

    steppers.step.emit({ field: null, delta: 1 });
    steppers.edit.emit(SetFields.Weight);

    expect(steps).toEqual([{ field: null, delta: 1 }]);
    expect(edits).toEqual([SetFields.Weight]);
  });

  it('carries a unit only on the targets that have one', () => {
    expect(rows(row()).steppers().map((s) => s.unit)).toEqual([
      null,
      null,
      'workouts.units.kgShort',
    ]);
    expect(rows(hold()).steppers()[1].unit).toBeNull();
  });

  it('holds the unit back until there is a number for it to qualify', () => {
    const steppers = rows(hold());
    const weight = steppers.steppers()[2];

    expect(steppers.isEmpty(weight)).toBe(true);
    expect(steppers.unitFor(weight)).toBeNull();
  });

  it('shows the unit as soon as the pad puts a digit in an empty target', () => {
    const steppers = rows(hold(), { active: SetFields.Weight, preview: '6' });
    const weight = steppers.steppers()[2];

    expect(steppers.shown(weight)).toBe('6');
    expect(steppers.isEmpty(weight)).toBe(false);
    expect(steppers.unitFor(weight)).toBe('workouts.units.kgShort');
  });

  // The live region said a bare "4": the row's "Sets" is hidden from a reader.
  it('says the set count in words, and only for the set count', () => {
    expect(rows(row()).steppers().map((s) => s.spoken)).toEqual(['count.sets', null, null]);
  });

  it('says the value with its unit, since the label no longer carries one', () => {
    const [, , weight] = rows(row()).steppers();

    expect(weight.typeLabel).toBe('workouts.routineBuilder.targets.type');
    expect(weight.value).toBe('60');
  });

  it('keeps a six character value at full size and steps a longer one down', () => {
    const six = row({ sets: [{ ...emptySet('s'), reps: 10, repsMax: 120 }] });
    const seven = row({ sets: [{ ...emptySet('s'), reps: 100, repsMax: 120 }] });

    expect(rows(six).steppers()[1]).toMatchObject({ value: '10–120', long: false });
    expect(rows(seven).steppers()[1]).toMatchObject({ value: '100–120', long: true });
  });

  it('names the unit in a title that stands away from the value', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      key === 'workouts.routineBuilder.targets.withUnit'
        ? `${params?.['field']} (${params?.['unit']})`
        : key;

    expect(stepperLabelWithUnit({ unilateral: false }, SetFields.Weight, t)).toBe(
      'workouts.routineBuilder.targets.weight (workouts.units.kgShort)',
    );
    expect(stepperLabelWithUnit({ unilateral: false }, SetFields.Duration, t)).toBe(
      'workouts.routineBuilder.targets.time',
    );
  });
});
