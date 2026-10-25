import { Component, computed, input, model, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { ORIGIN_PILLS, ProgramOrigin } from '../../programs.config';

/**
 * The library's second axis, off the toolbar.
 *
 * The kind of thing (program or routine) stays in the pill row, because it is
 * how coaches look for what they made. Whose it is (theirs or MotionHive's)
 * lives here — matching the exercises and sessions libraries, where one chip
 * row carries a Filters trigger and a single axis of pills. Two stacked rows
 * cost a third of the screen above the fold and read as one confused control.
 */
@Component({
  selector: 'mh-program-filter-sheet',
  imports: [IonButton, SheetShell, TranslatePipe],
  templateUrl: './program-filter-sheet.html',
  styleUrl: './program-filter-sheet.scss',
})
export class ProgramFilterSheet {
  readonly open = model(false);
  /** Whose content the list shows right now. */
  readonly origin = input.required<ProgramOrigin>();
  /** Row counts per origin, so a chip predicts its own result. */
  readonly counts = input.required<Record<ProgramOrigin, number>>();

  readonly apply = output<ProgramOrigin>();

  readonly originChips = ORIGIN_PILLS;

  /** Held locally so Cancel really cancels. */
  private readonly _draft = signal<ProgramOrigin | null>(null);

  readonly draftOrigin = computed(() => this._draft() ?? this.origin());

  isOn(value: ProgramOrigin): boolean {
    return this.draftOrigin() === value;
  }

  countFor(value: ProgramOrigin): number {
    return this.counts()[value] ?? 0;
  }

  choose(value: ProgramOrigin): void {
    this._draft.set(value);
  }

  /** Closed without Show results: the next open starts from what the list shows. */
  discard(): void {
    this._draft.set(null);
  }

  commit(): void {
    const chosen = this.draftOrigin();
    this._draft.set(null);
    this.open.set(false);
    this.apply.emit(chosen);
  }
}
