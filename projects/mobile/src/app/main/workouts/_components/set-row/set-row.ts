import { Component, computed, input, output, viewChild } from '@angular/core';
import {
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { LoggedSet, SetField, SetFields, setFieldsFor } from 'core';

import { formatMeasure, secondsToClock, setPlaceholder, setTypeMark } from '../../workouts.config';

/** One input cell as the row draws it. */
interface SetCell {
  field: SetField;
  value: string;
  placeholder: string;
  active: boolean;
}

/**
 * One set: what was planned, what happened, and the tick that says it did.
 *
 * The tick alone is a valid log — every number is optional — so the checkbox
 * is the largest target in the row and never gated on a value being present.
 *
 * Which cells appear is driven by the exercise's kind via `setFieldsFor`, so
 * a plank shows a duration cell and no weight field at all. An empty cell
 * shows the target in grey (or last time's number when nothing is
 * prescribed), and the cell open in the keypad shows what is being typed.
 *
 * A set comes out by swiping the row left, or by tapping its number, which
 * opens the same Remove option — the swipe alone would be invisible.
 *
 * The cells and the tick are plain buttons on theme tokens rather than
 * `ion-button`s on purpose: they are grid cells sized for a thumb between
 * sets, and Ionic's button chrome (its padding, its ripple, its label
 * sizing) fights a grid at every row.
 */
@Component({
  selector: 'mh-set-row',
  imports: [IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, TranslatePipe],
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
  /** What the keypad has built so far for the open cell, already formatted. */
  readonly draft = input<string | null>(null);

  readonly toggle = output<void>();
  readonly edit = output<SetField>();
  readonly remove = output<void>();

  private readonly _sliding = viewChild.required<IonItemSliding>('sliding');

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

  readonly cells = computed<SetCell[]>(() =>
    this.fields().map((field) => {
      const active = this.editing() === field;
      const draft = this.draft();
      return {
        field,
        active,
        value: active && draft !== null ? draft : this.cellValue(field),
        placeholder: setPlaceholder(this.set(), field, this.previous()),
      };
    }),
  );

  /** Only shown when it is not a plain working set. */
  readonly typeMark = computed(() => setTypeMark(this.set().setType));

  /** "60 × 8" from the same set number last time — the memory aid. */
  readonly previousLabel = computed(() => {
    const prev = this.previous();
    if (!prev) return '—';
    const bits: string[] = [];
    if (prev.weightKg != null) bits.push(formatMeasure(prev.weightKg));
    if (prev.reps != null) bits.push(formatMeasure(prev.reps));
    if (prev.durationSeconds != null) bits.push(secondsToClock(prev.durationSeconds));
    return bits.length ? bits.join(' × ') : '—';
  });

  /** The number is a button: it slides the row open on its Remove option. */
  openOptions(): void {
    void this._sliding().open('end');
  }

  onRemove(): void {
    void this._sliding().close();
    this.remove.emit();
  }

  cellValue(field: SetField): string {
    const set = this.set();
    switch (field) {
      case SetFields.Weight:
        return set.weightKg == null ? '' : formatMeasure(set.weightKg);
      case SetFields.Reps:
        return set.reps == null ? '' : String(set.reps);
      case SetFields.Duration:
        // A hold reads as a clock, not as a count of seconds: 90 is "1:30".
        return set.durationSeconds == null ? '' : secondsToClock(set.durationSeconds);
      case SetFields.Distance:
        return set.distanceMeters == null ? '' : formatMeasure(set.distanceMeters);
    }
  }
}
