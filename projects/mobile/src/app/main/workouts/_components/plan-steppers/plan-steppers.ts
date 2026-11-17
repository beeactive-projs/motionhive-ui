import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SetField, SetFields } from 'core';

import { cellValue, fieldText } from '../../logger/logger-flow';
import {
  DraftExercise,
  repsRangeText,
  stepperFields,
} from '../../routine-builder/routine-builder.config';

/** One ± on a row: the number of sets (`field` null), or a field of every set. */
export interface PlanStep {
  field: SetField | null;
  delta: 1 | -1;
}

/** One row: its name, then − value +. */
export interface PlanStepper {
  /** The field it steps, or null for the number of sets. */
  field: SetField | null;
  label: string;
  value: string;
  /** The unit that rides beside the number ("kg", "m"), or null for none. */
  unit: string | null;
  long: boolean;
  canLower: boolean;
  groupLabel: string;
  lowerLabel: string;
  raiseLabel: string;
  /** The value opens the pad: every field but the set count. */
  typeLabel: string | null;
  /**
   * The set count in words ("4 sets"), announced as it changes: the bare
   * number said nothing, since the row's "Sets" is hidden from a reader.
   * Null on the rows the pad types into: their buttons carry the value.
   */
  spoken: string | null;
}

/** The rows' names, by what they step. Reps read as per side on one-sided work. */
const STEPPER_LABELS: Record<SetField | 'sets' | 'repsEach', string> = {
  sets: 'workouts.routineBuilder.targets.sets',
  [SetFields.Reps]: 'workouts.routineBuilder.targets.reps',
  repsEach: 'workouts.routineBuilder.targets.repsEach',
  [SetFields.Duration]: 'workouts.routineBuilder.targets.time',
  [SetFields.Distance]: 'workouts.routineBuilder.targets.distance',
  [SetFields.Weight]: 'workouts.routineBuilder.targets.weight',
};

/** The same, as words inside a sentence: "Lower the weight for Bench press". */
const STEPPER_WORDS: Record<SetField | 'repsEach', string> = {
  [SetFields.Reps]: 'workouts.routineBuilder.targets.words.reps',
  repsEach: 'workouts.routineBuilder.targets.words.repsEach',
  [SetFields.Duration]: 'workouts.routineBuilder.targets.words.time',
  [SetFields.Distance]: 'workouts.routineBuilder.targets.words.distance',
  [SetFields.Weight]: 'workouts.routineBuilder.targets.words.weight',
};

/** The unit that rides beside a number, by field. Reps and time carry none. */
const STEPPER_UNITS: Partial<Record<SetField, string>> = {
  [SetFields.Weight]: 'workouts.units.kgShort',
  [SetFields.Distance]: 'workouts.units.metersShort',
};

/**
 * What a target with nothing in it shows, as the set table's cells do: a
 * dash. It is punctuation rather than copy, so it carries no key; the
 * aria-label says "not set" in words, which is where a reader needs them.
 */
const EMPTY_VALUE = '–';

/**
 * Past six characters ("1000.5", "1:05:00") a value steps down one size, to
 * the body step and no smaller. The unit sits beside the number now rather
 * than inside the label, so there is a little less room for it, and a number
 * nobody can read is worse than one drawn a shade smaller.
 */
const LONG_VALUE = 6;

/** The row's own name for a target: "Weight", the kg being on the value. */
export function stepperLabelKey(row: Pick<DraftExercise, 'unilateral'>, field: SetField): string {
  return STEPPER_LABELS[field === SetFields.Reps && row.unilateral ? 'repsEach' : field];
}

/**
 * The same with its unit, for a title that stands away from the number it
 * belongs to: the pad's "Back squat · Weight (kg)". A row says "Weight" and
 * carries the kg beside the value instead.
 */
export function stepperLabelWithUnit(
  row: Pick<DraftExercise, 'unilateral'>,
  field: SetField,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const label = t(stepperLabelKey(row, field));
  const unitKey = STEPPER_UNITS[field];
  return unitKey
    ? t('workouts.routineBuilder.targets.withUnit', { field: label, unit: t(unitKey) })
    : label;
}

/**
 * An exercise of a routine being built, planned the same for every set:
 * one row per target, its name on the left and − value + on the right,
 * stacked (user decision, 2026-11-16: three steppers abreast were too
 * cramped, and a sheet one tap away was not wanted). Sets first, then Reps
 * or Time, then Weight.
 *
 * A value opens the page's number pad for that target, for every set; the
 * row it types into wears the honey ring and echoes what is typed. The page
 * applies every step and every typed value to its draft.
 */
@Component({
  selector: 'mh-plan-steppers',
  imports: [IonButton, IonIcon, TranslatePipe],
  templateUrl: './plan-steppers.html',
  styleUrl: './plan-steppers.scss',
})
export class PlanSteppers {
  private readonly _translateService = inject(TranslateService);

  readonly exercise = input.required<DraftExercise>();
  /** The target the page's pad is typing into, for this exercise; null when none. */
  readonly active = input<SetField | null>(null);
  /** What the pad has typed so far for it, formatted; null until touched. */
  readonly preview = input<string | null>(null);

  readonly step = output<PlanStep>();
  /** A value was tapped: the pad opens on that target. */
  readonly edit = output<SetField>();

  readonly steppers = computed<PlanStepper[]>(() => {
    const row = this.exercise();
    const t = (key: string, params?: Record<string, unknown>) =>
      this._translateService.instant(key, params);
    const count = row.sets.length;
    const sets: PlanStepper = {
      field: null,
      label: STEPPER_LABELS.sets,
      value: String(count),
      unit: null,
      long: false,
      canLower: count > 1,
      groupLabel: t('workouts.routineBuilder.stepper.group', { name: row.name }),
      lowerLabel: t('workouts.routineBuilder.stepper.fewer', { name: row.name }),
      raiseLabel: t('workouts.routineBuilder.stepper.more', { name: row.name }),
      typeLabel: null,
      spoken: t('count.sets', { count }),
    };
    const first = row.sets[0] ?? null;
    return [
      sets,
      ...stepperFields(row).map((field): PlanStepper => {
        const value = cellValue(first, field);
        const range = field === SetFields.Reps && first ? repsRangeText(first) : null;
        const text = range ?? (value === null ? EMPTY_VALUE : fieldText(field, value, false));
        // Said in words, with its unit: a screen reader makes nothing of the
        // dash, and the label no longer carries the kg for it either.
        const spoken =
          range ?? (value === null ? t('form.placeholder.notSet') : fieldText(field, value, true));
        const unitKey = STEPPER_UNITS[field];
        const wordKey = field === SetFields.Reps && row.unilateral ? 'repsEach' : field;
        const word = t(STEPPER_WORDS[wordKey]);
        return {
          field,
          label: stepperLabelKey(row, field),
          value: text,
          unit: unitKey ? t(unitKey) : null,
          long: text.length > LONG_VALUE,
          canLower: value !== null,
          groupLabel: t('workouts.routineBuilder.targets.group', { field: word, name: row.name }),
          lowerLabel: t('workouts.routineBuilder.targets.lower', { field: word, name: row.name }),
          raiseLabel: t('workouts.routineBuilder.targets.raise', { field: word, name: row.name }),
          typeLabel: t('workouts.routineBuilder.targets.type', {
            field: word,
            name: row.name,
            value: spoken,
          }),
          spoken: null,
        };
      }),
    ];
  });

  /**
   * The pad is typing into this row. Marked `data-editing` too, so the page
   * keeps it above the pad. Never the Sets row: it has no field, and a field
   * of null would match a closed pad.
   */
  isActive(stepper: PlanStepper): boolean {
    return stepper.field !== null && this.active() === stepper.field;
  }

  /** What a row shows: the pad's echo while it types into it, else the value. */
  shown(stepper: PlanStepper): string {
    const preview = this.preview();
    return this.isActive(stepper) && preview !== null ? preview || EMPTY_VALUE : stepper.value;
  }

  /** The row is showing its placeholder, so there is no number on it. */
  isEmpty(stepper: PlanStepper): boolean {
    return this.shown(stepper) === EMPTY_VALUE;
  }

  /**
   * The unit, while there is a number for it to qualify. A lone "kg" under
   * an empty weight reads as a value of its own.
   */
  unitFor(stepper: PlanStepper): string | null {
    return stepper.unit !== null && !this.isEmpty(stepper) ? stepper.unit : null;
  }
}
