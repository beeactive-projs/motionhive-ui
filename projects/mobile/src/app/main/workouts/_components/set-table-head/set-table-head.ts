import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SetField, SetFields } from 'core';

/**
 * Each field's column heading, as translation keys: sentence case, and the
 * unit where the cells drop it ("kg", "m"). The lowercase `columns` keys are
 * the pad's label ("Set 2 · kg"), not headings.
 */
const FIELD_LABELS: Record<SetField, string> = {
  [SetFields.Weight]: 'workouts.logger.gridHead.weight',
  [SetFields.Reps]: 'workouts.logger.gridHead.reps',
  [SetFields.Duration]: 'workouts.logger.gridHead.time',
  [SetFields.Distance]: 'workouts.logger.gridHead.distance',
};

/**
 * The headings over an exercise's set table: set, previous, one per field,
 * and Done over the ticks. Sentence case, unlike the prototype's capitals:
 * the app adds no uppercase labels (colour-and-type.md). Hidden from screen
 * readers: every cell of `mh-set-row` already names what it is, so the
 * headings would only be read twice.
 */
@Component({
  selector: 'mh-set-table-head',
  imports: [TranslatePipe],
  templateUrl: './set-table-head.html',
  styleUrl: './set-table-head.scss',
  host: {
    'aria-hidden': 'true',
    '[style.--mh-set-fields]': 'fields().length',
  },
})
export class SetTableHead {
  /** The cells the exercise records, in the order its rows draw them. */
  readonly fields = input.required<readonly SetField[]>();
  /** Split squats and single-arm work: reps read as per side. */
  readonly unilateral = input(false);

  readonly labels = computed(() =>
    this.fields().map((field) =>
      field === SetFields.Reps && this.unilateral()
        ? 'workouts.logger.gridHead.repsEach'
        : FIELD_LABELS[field],
    ),
  );
}
