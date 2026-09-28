import { Component, computed, input, model, output, signal } from '@angular/core';
import { IonChip } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ProgramSize, ProgramSizes } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { LIBRARY_PILLS } from '../../programs.config';

/**
 * The library's second axis, off the toolbar.
 *
 * Origin stays in the pill row because it answers "is this mine?", which is
 * the question worth seeing without a tap. Everything else lives here —
 * matching the exercises and sessions libraries, where one chip row carries
 * a Filters trigger and a single axis of pills. Two stacked rows cost a
 * third of the screen above the fold and read as one confused control.
 */
@Component({
  selector: 'mh-program-filter-sheet',
  imports: [IonChip, SheetShell, TranslatePipe],
  templateUrl: './program-filter-sheet.html',
  styleUrl: './program-filter-sheet.scss',
})
export class ProgramFilterSheet {
  readonly open = model(false);
  /** What the list is filtered by right now. */
  readonly size = input.required<ProgramSize>();
  /** Row counts per size, so a chip predicts its own result. */
  readonly counts = input.required<Record<ProgramSize, number>>();

  readonly apply = output<ProgramSize>();

  readonly sizeChips = LIBRARY_PILLS;

  /** Held locally so Cancel really cancels. */
  private readonly _draft = signal<ProgramSize | null>(null);

  readonly draftSize = computed(() => this._draft() ?? this.size());

  isOn(value: ProgramSize): boolean {
    return this.draftSize() === value;
  }

  countFor(value: ProgramSize): number {
    return this.counts()[value] ?? 0;
  }

  choose(value: ProgramSize): void {
    this._draft.set(value);
  }

  clear(): void {
    this._draft.set(ProgramSizes.All);
  }

  commit(): void {
    const chosen = this.draftSize();
    this._draft.set(null);
    this.open.set(false);
    this.apply.emit(chosen);
  }
}
