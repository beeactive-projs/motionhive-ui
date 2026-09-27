import { Component, computed, input, model, output, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { toggleValue } from '../../../../_shared/utils/list.utils';
import { DAY_LABELS } from '../../programs.config';

/**
 * Copy one day into the same day of other weeks — "Monday is the same for
 * weeks 2 to 5".
 *
 * Multi-select like the week sheet, because repeating a day across a block
 * is the whole point; one week at a time would be several trips through the
 * same list.
 *
 * Copying replaces, matching copy-week — one rule, so nobody has to
 * remember which verb merges. What this sheet adds is saying so *before* it
 * happens, and naming the count: a day is where the detail lives, and
 * silently overwriting three of them is a bad surprise.
 *
 * Landing on a *different* day is offered only when exactly one week is
 * chosen. Across a block "which day?" has no single answer, and asking it
 * once per week would be a different feature — so the row simply is not
 * there until the question makes sense.
 */
@Component({
  selector: 'mh-copy-day-sheet',
  imports: [IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote, SheetShell],
  templateUrl: './copy-day-sheet.html',
  styleUrl: './copy-day-sheet.scss',
})
export class CopyDaySheet {
  readonly open = model(false);
  readonly fromWeek = input.required<number>();
  readonly weekCount = input.required<number>();
  /** The day's own name, so the sheet says "Copy Upper A" not "Copy day 2". */
  readonly dayName = input('');
  /**
   * Weeks that already have something in this day slot. Drives the warning —
   * the page knows the program's shape, this sheet only renders it.
   */
  readonly occupiedWeeks = input<readonly number[]>([]);
  /** The day being copied from — the default target, and the one to exclude. */
  readonly sourceDay = input.required<number>();
  /**
   * Weeks with training on each day, indexed by day — so the warning stays
   * right when the copy is aimed at a different day than the source.
   */
  readonly occupiedTargetDay = input<readonly (readonly number[])[]>([]);

  /** The chosen weeks, and the day to land on when it differs. */
  readonly copy = output<{ weeks: number[]; toDayIndex?: number }>();

  readonly selected = signal<number[]>([]);

  /** Null while it matches the source — the usual case. */
  readonly targetDay = signal<number | null>(null);

  readonly dayLabels = DAY_LABELS;

  /** Every week but the one being copied from. */
  readonly targets = computed(() =>
    Array.from({ length: this.weekCount() }, (_, i) => i).filter(
      (i) => i !== this.fromWeek(),
    ),
  );

  readonly title = computed(() => {
    const name = this.dayName().trim();
    return name ? `Copy ${name}` : 'Copy this day';
  });

  /**
   * Picking a different day is a single-week question, so the control only
   * appears once exactly one week is chosen.
   */
  readonly canChooseDay = computed(() => this.selected().length === 1);

  /** The day this copy would land on — the source day unless changed. */
  readonly effectiveDay = computed(() => this.targetDay() ?? this.sourceDay());

  readonly confirmLabel = computed(() => {
    const n = this.selected().length;
    if (n === 0) return 'Copy to…';
    if (n === 1 && this.effectiveDay() !== this.sourceDay()) {
      return `Copy to ${this.dayLabels[this.effectiveDay()]}`;
    }
    return `Copy to ${n} ${n === 1 ? 'week' : 'weeks'}`;
  });

  /** Chosen weeks that already hold training on this day. */
  private readonly _clashes = computed(() => {
    // A different target day is a different slot, so the occupied list —
    // which is about the source day — no longer answers the question. The
    // page recomputes it; until then, warn on nothing rather than wrongly.
    if (this.effectiveDay() !== this.sourceDay()) {
      const onThatDay = this.occupiedTargetDay()[this.effectiveDay()] ?? [];
      return this.selected().filter((w) => onThatDay.includes(w));
    }
    return this.selected().filter((w) => this.occupiedWeeks().includes(w));
  });

  /**
   * Named before the copy, not after: "replace" is the rule, and the only
   * thing worth saying is how much of it is about to happen.
   */
  readonly replaceWarning = computed(() => {
    const n = this._clashes().length;
    if (n === 0) return '';
    return n === 1
      ? 'One of those weeks already has training on this day. It will be replaced.'
      : `${n} of those weeks already have training on this day. They will be replaced.`;
  });

  setTargetDay(day: number): void {
    this.targetDay.set(day === this.sourceDay() ? null : day);
  }

  isOn(index: number): boolean {
    return this.selected().includes(index);
  }

  /** True for a week that already holds training in this slot. */
  isOccupied(index: number): boolean {
    return this.occupiedWeeks().includes(index);
  }

  toggle(index: number): void {
    this.selected.update((rows) => toggleValue(rows, index));
  }

  apply(): void {
    const chosen = [...this.selected()].sort((a, b) => a - b);
    const day = this.canChooseDay() ? (this.targetDay() ?? undefined) : undefined;
    this.selected.set([]);
    this.targetDay.set(null);
    this.open.set(false);
    this.copy.emit({ weeks: chosen, toDayIndex: day });
  }
}
