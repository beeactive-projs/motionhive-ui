import { Component, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { ExerciseSortKey } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SORT_OPTIONS } from '../../exercises.config';

/**
 * How the library is ordered — the three keys the catalogue endpoint can
 * actually sort by.
 *
 * Its own sheet rather than a section of the filter sheet, and it applies on
 * tap rather than on a footer button. Sorting is not narrowing: sharing a
 * surface with the filters would suggest that changing the order resets
 * them, which is exactly the thing the split is there to prevent.
 */
@Component({
  selector: 'mh-exercise-sort-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './exercise-sort-sheet.html',
  styleUrl: './exercise-sort-sheet.scss',
})
export class ExerciseSortSheet {
  readonly open = model(false);
  readonly sort = input.required<ExerciseSortKey>();

  readonly sorted = output<ExerciseSortKey>();

  readonly options = SORT_OPTIONS;

  pick(value: ExerciseSortKey): void {
    if (value !== this.sort()) this.sorted.emit(value);
    this.open.set(false);
  }
}
