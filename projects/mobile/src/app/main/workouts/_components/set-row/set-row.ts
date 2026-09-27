import { Component, computed, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import { LoggedSet, SetField, SetFields, setFieldsFor } from 'core';

import { secondsToClock, setTypeMark } from '../../workouts.config';

/**
 * One set: what was planned, what happened, and the tick that says it did.
 *
 * The tick alone is a valid log — every number is optional — so the checkbox
 * is the largest target in the row and never gated on a value being present.
 *
 * Which cells appear is driven by the exercise's kind via `setFieldsFor`, so
 * a plank shows a duration cell and no weight field at all.
 *
 * The cells and the tick are plain buttons on theme tokens rather than
 * `ion-button`s on purpose: they are grid cells sized for a thumb between
 * sets, and Ionic's button chrome (its padding, its ripple, its label
 * sizing) fights a grid at every row.
 */
@Component({
  selector: 'mh-set-row',
  imports: [IonIcon],
  templateUrl: './set-row.html',
  styleUrl: './set-row.scss',
})
export class SetRow {
  readonly set = input.required<LoggedSet>();
  readonly index = input.required<number>();
  readonly kind = input<string | null>(null);
  /** What the user did for this set number last time. */
  readonly previous = input<LoggedSet | null>(null);
  /** The cell currently open in the keypad, if it belongs to this row. */
  readonly editing = input<SetField | null>(null);

  readonly toggle = output<void>();
  readonly edit = output<SetField>();

  /** Split squats and single-arm work are logged per side. */
  readonly unilateral = input(false);
  /**
   * Bodyweight work the user has opted into loading — weighted pull-ups and
   * dips still deserve a volume number.
   */
  readonly showAddedWeight = input(false);

  readonly fields = computed<SetField[]>(() => {
    const base = setFieldsFor(this.kind());
    // Weight is prepended rather than appended so the column order matches
    // a loaded exercise: weight then reps, everywhere.
    return this.showAddedWeight() && !base.includes(SetFields.Weight)
      ? [SetFields.Weight, ...base]
      : base;
  });

  /** Only shown when it is not a plain working set. */
  readonly typeMark = computed(() => setTypeMark(this.set().setType));

  /** "60 × 8" from the same set number last time — the memory aid. */
  readonly previousLabel = computed(() => {
    const prev = this.previous();
    if (!prev) return '—';
    const bits: string[] = [];
    if (prev.weightKg != null) bits.push(`${prev.weightKg}`);
    if (prev.reps != null) bits.push(`${prev.reps}`);
    if (prev.durationSeconds != null) bits.push(secondsToClock(prev.durationSeconds));
    return bits.length ? bits.join(' × ') : '—';
  });

  cellValue(field: SetField): string {
    const set = this.set();
    switch (field) {
      case SetFields.Weight:
        return set.weightKg == null ? '' : String(set.weightKg);
      case SetFields.Reps:
        return set.reps == null ? '' : String(set.reps);
      case SetFields.Duration:
        // A hold reads as a clock, not as a count of seconds: 90 is "1:30".
        return set.durationSeconds == null ? '' : secondsToClock(set.durationSeconds);
      case SetFields.Distance:
        return set.distanceMeters == null ? '' : String(set.distanceMeters);
    }
  }
}
