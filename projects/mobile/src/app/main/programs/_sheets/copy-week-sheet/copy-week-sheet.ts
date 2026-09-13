import { Component, computed, input, model, output, signal } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { toggleValue } from '../../../../_shared/utils/list.utils';

/**
 * Copy one week onto others — the single biggest time-saver in authoring,
 * because most blocks repeat a week's shape and change the loads.
 *
 * Multi-select, since "weeks 2, 3 and 4 look like week 1" is the usual case
 * and doing it one week at a time is three trips through the same sheet.
 */
@Component({
  selector: 'mh-copy-week-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './copy-week-sheet.html',
  styleUrl: './copy-week-sheet.scss',
})
export class CopyWeekSheet {
  readonly open = model(false);
  readonly fromWeek = input.required<number>();
  readonly weekCount = input.required<number>();

  readonly copy = output<number[]>();

  readonly selected = signal<number[]>([]);

  /** Every week but the one being copied from. */
  readonly targets = computed(() =>
    Array.from({ length: this.weekCount() }, (_, i) => i).filter(
      (i) => i !== this.fromWeek(),
    ),
  );

  readonly title = computed(() => `Copy week ${this.fromWeek() + 1}`);

  readonly confirmLabel = computed(() => {
    const n = this.selected().length;
    if (n === 0) return 'Copy to…';
    return `Copy to ${n} ${n === 1 ? 'week' : 'weeks'}`;
  });

  isOn(index: number): boolean {
    return this.selected().includes(index);
  }

  toggle(index: number): void {
    this.selected.update((rows) => toggleValue(rows, index));
  }

  apply(): void {
    const chosen = [...this.selected()].sort((a, b) => a - b);
    this.selected.set([]);
    this.open.set(false);
    this.copy.emit(chosen);
  }

  onOpenChange(open: boolean): void {
    if (!open) this.selected.set([]);
  }
}
