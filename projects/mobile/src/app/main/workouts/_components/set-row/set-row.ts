import { Component, computed, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { LoggedSet, SetField, SetFields } from 'core';

import { SetBadge, SetRowMode, SetRowModes, cellValue, fieldText } from '../../logger/logger-flow';
import { formatMeasure } from '../../workouts.config';

/** One field of the row, as drawn. */
interface SetCell {
  field: SetField;
  text: string;
  /** The grey pre-fill, not a value: shown until confirmed or typed over. */
  prefill: boolean;
  active: boolean;
  /** Longer than `LONG_CELL`: one text size down, so it still fits. */
  long: boolean;
  /** The unit's key, drawn after the value, when no heading names the column. */
  unit: string | null;
}

/**
 * The units a cell names when its column has no heading. Reps and a clock
 * read as what they are beside a weight or a distance, so only these two.
 */
const CELL_UNITS: Partial<Record<SetField, string>> = {
  [SetFields.Weight]: 'workouts.units.kgShort',
  [SetFields.Distance]: 'workouts.units.metersShort',
};

/**
 * Past six characters a value steps down a size: the keypad's longest
 * weight, 9999.99, otherwise clips by a few pixels on an SE at 130% text,
 * where Previous has dropped and the fields are at their narrowest.
 */
const LONG_CELL = 6;

/**
 * One set of the logger, as a row of the set table:
 *
 *     [badge] [previous] [kg] [reps] [✓]
 *
 * Every set reads the same way, so the eye runs down a column, as the
 * workout prototype draws it. **Done** is a soft green behind the row and
 * the filled tick (its fields stay fields). **Selected**, the set open in
 * the number pad, takes the selection fill, with the honey ring on the
 * field being typed: one selected line at a time. A set not done yet shows
 * its pre-fill in grey, whether it is the next one or further ahead.
 *
 * - The badge (number, or W / D / F / A) opens the set's menu.
 * - Previous is what this set held last time; tapping it copies those
 *   numbers in, the quickest way to repeat a session.
 * - A field opens the number pad on it. A tick alone is a valid log: the
 *   grey pre-fill is saved as it stands. So a field cleared on the pad
 *   shows its pre-fill again, as an empty field does: that is what the tick
 *   will save.
 *
 * The column headings live in `mh-set-table-head`, on the same grid. A row
 * without one over it (a superset round, whose rows belong to different
 * exercises) sets `units`, and weight and distance name their unit in the
 * cell. Too narrow for the Previous column, Previous moves under the fields
 * as "last 60 × 8" (`set-row.scss`).
 * Plain buttons on theme tokens rather than Ionic's: these are grid cells
 * sized for a thumb between sets, and Ionic's button chrome fights them.
 */
@Component({
  selector: 'mh-set-row',
  imports: [IonIcon, TranslatePipe],
  templateUrl: './set-row.html',
  styleUrl: './set-row.scss',
  host: {
    '[style.--mh-set-fields]': 'fields().length',
  },
})
export class SetRow {
  readonly set = input.required<LoggedSet>();
  readonly mode = input.required<SetRowMode>();
  readonly badge = input.required<SetBadge>();
  /** The cells this exercise records, in order. */
  readonly fields = input.required<readonly SetField[]>();
  /** What each empty field is pre-filled with. */
  readonly prefill = input<Partial<Record<SetField, number | null>>>({});
  /** The same set last time, "60 × 8", or empty when there was none. */
  readonly previous = input('');
  /** The field open in the number pad, when it belongs to this set. */
  readonly editing = input<SetField | null>(null);
  /**
   * What the pad has built so far for that field, already formatted: `null`
   * until something is typed (the field shows its own value), `''` once it
   * is cleared (the field shows empty).
   */
  readonly draft = input<string | null>(null);
  /** No column heading over this row: weight and distance carry their unit. */
  readonly units = input(false);

  readonly tick = output<void>();
  readonly edit = output<SetField>();
  readonly menu = output<void>();
  /** Previous was tapped: fill this set with last time's numbers. */
  readonly usePrevious = output<void>();

  readonly Modes = SetRowModes;

  readonly rpe = computed(() => {
    const rpe = this.set().rpe;
    return rpe == null ? '' : formatMeasure(Number(rpe), 1);
  });

  readonly cells = computed<SetCell[]>(() => {
    const set = this.set();
    const prefill = this.prefill();
    const draft = this.draft();
    const units = this.units();
    return this.fields().map((field) => {
      const active = this.editing() === field;
      // Something typed on the pad is shown as typed; cleared to nothing, the
      // field is empty, so it shows what an empty field shows.
      const typing = active && draft !== null && draft !== '';
      const cleared = active && draft === '';
      const value = cleared ? null : cellValue(set, field);
      const shown = value ?? prefill[field] ?? null;
      const text = typing ? draft : shown == null ? '' : fieldText(field, shown, false);
      return {
        field,
        active,
        prefill: value == null && !typing,
        text,
        long: text.length > LONG_CELL,
        unit: units && text ? (CELL_UNITS[field] ?? null) : null,
      };
    });
  });
}
