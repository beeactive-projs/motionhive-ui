import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
// No standalone export for Table + its reorder directives — module fallback.
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { EnumLabelPipe, PrescribedExercise, PrescribedSet } from 'core';

import {
  commonRestSeconds,
  prescriptionSummary,
  setSummary,
  setTypeSeverity,
} from '../builder.utils';

/**
 * One exercise inside the workout editor: a collapsed row with the
 * one-line prescription, expanding into the editable set table.
 * Presentational — every mutation is relayed to the container as an
 * output.
 */
@Component({
  selector: 'mh-exercise-row',
  imports: [EnumLabelPipe, TranslatePipe, ButtonDirective, TableModule, Tag, Tooltip],
  templateUrl: './exercise-row.html',
  styleUrl: './exercise-row.scss',
})
export class ExerciseRow {
  private readonly _translateService = inject(TranslateService);

  readonly exercise = input.required<PrescribedExercise>();
  readonly index = input.required<number>();
  readonly count = input.required<number>();
  readonly expanded = input(false);
  readonly canMoveAcross = input(false);

  readonly toggle = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly moveTo = output<void>();
  readonly remove = output<void>();
  readonly viewExercise = output<void>();
  readonly addSet = output<void>();
  readonly editSet = output<PrescribedSet>();
  readonly duplicateSet = output<PrescribedSet>();
  readonly removeSet = output<PrescribedSet>();
  readonly setsReordered = output<PrescribedSet[]>();

  readonly name = computed(() => this.exercise().exercise?.name ?? '—');
  readonly prescription = computed(() => prescriptionSummary(this.exercise()));
  /** "75s rest" when every set shares the same rest, else nothing. */
  readonly restLabel = computed(() => {
    const rest = commonRestSeconds(this.exercise());
    return rest != null
      ? this._translateService.instant('programs.exerciseRow.restLabel', { seconds: rest })
      : null;
  });

  protected readonly setSummary = setSummary;
  protected readonly setTypeSeverity = setTypeSeverity;
  protected readonly trackSetById = (_: number, s: PrescribedSet): string => s.id;

  /**
   * Row drag inside the sets table. PrimeNG has already reordered the
   * bound array in place — it IS the target order.
   */
  onRowReorder(): void {
    this.setsReordered.emit(this.exercise().sets ?? []);
  }
}
