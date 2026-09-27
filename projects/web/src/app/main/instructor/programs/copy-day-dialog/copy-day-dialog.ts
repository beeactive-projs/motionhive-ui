import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { SelectItem } from 'primeng/api';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';

import { Program, ProgramWorkout } from 'core';

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** What the parent needs to perform the copy. */
export interface CopyDayChoice {
  weeks: number[];
  /** Only set when the copy lands on a different day than the source. */
  toDayIndex?: number;
}

/**
 * "Copy this day…" picker for the program builder.
 *
 * Multi-select, because repeating a day across a block is the usual reason
 * to reach for it and one week at a time would be several trips.
 *
 * Copying replaces whatever sits in the target slot — the same rule as
 * copy-week, so nobody has to remember which verb merges. The dialog names
 * the count before committing rather than after.
 *
 * The "land it on" day only appears once exactly one week is chosen: across
 * a block "which day?" has no single answer, and the API rejects the
 * combination rather than guessing.
 */
@Component({
  selector: 'mh-copy-day-dialog',
  imports: [FormsModule, ButtonDirective, Dialog, MultiSelect, Select],
  templateUrl: './copy-day-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyDayDialog {
  readonly program = input.required<Program>();
  /** The day being copied — its week, its slot, and its name. */
  readonly sourceWorkout = input.required<ProgramWorkout>();
  readonly visible = model<boolean>(false);

  readonly chosen = output<CopyDayChoice>();

  readonly targetWeeks = signal<number[]>([]);
  /** Null while it matches the source day — the usual case. */
  readonly targetDay = signal<number | null>(null);

  readonly dayNames = DAY_NAMES;

  private readonly _totalWeeks = computed(() => {
    const days = this.program().durationDays ?? 84;
    return Math.max(1, Math.ceil(days / 7));
  });

  readonly sourceWeek = computed(() => this.sourceWorkout().weekIndex);
  readonly sourceDay = computed(() => this.sourceWorkout().dayIndex);

  readonly sourceLabel = computed(() => {
    const w = this.sourceWorkout();
    return `${w.name} · ${DAY_NAMES[w.dayIndex]}, week ${w.weekIndex + 1}`;
  });

  /** The day this copy lands on — the source day unless changed. */
  readonly effectiveDay = computed(() => this.targetDay() ?? this.sourceDay());

  /** Single-week question, so the control waits for a single week. */
  readonly canChooseDay = computed(() => this.targetWeeks().length === 1);

  /** Which weeks already hold something in the slot being aimed at. */
  private readonly _weeksWithTargetDay = computed(() => {
    const day = this.effectiveDay();
    return new Set(
      (this.program().workouts ?? [])
        .filter((w) => w.dayIndex === day)
        .map((w) => w.weekIndex),
    );
  });

  readonly weekOptions = computed<SelectItem<number>[]>(() => {
    const occupied = this._weeksWithTargetDay();
    const source = this.sourceWeek();
    const sameDay = this.effectiveDay() === this.sourceDay();
    return Array.from({ length: this._totalWeeks() }, (_, i) => ({
      value: i,
      label: occupied.has(i)
        ? `Week ${i + 1} · will be replaced`
        : `Week ${i + 1} (empty that day)`,
      // Copying onto its own slot is a no-op; a different day in the same
      // week is a real target.
      disabled: sameDay && i === source,
    }));
  });

  readonly dayOptions = computed<SelectItem<number>[]>(() =>
    DAY_NAMES.map((name, i) => ({ value: i, label: name })),
  );

  /** Chosen weeks that already hold training in the target slot. */
  readonly clashCount = computed(() => {
    const occupied = this._weeksWithTargetDay();
    return this.targetWeeks().filter((w) => occupied.has(w)).length;
  });

  readonly canSubmit = computed(() => this.targetWeeks().length > 0);

  readonly submitLabel = computed(() => {
    const n = this.targetWeeks().length;
    if (n === 0) return 'Copy';
    if (this.clashCount() > 0) {
      return n === 1 ? 'Replace that day' : `Replace in ${n} weeks`;
    }
    return n === 1 ? 'Copy into 1 week' : `Copy into ${n} weeks`;
  });

  constructor() {
    // A fresh source means a fresh choice; leaving the previous selection
    // armed is how someone copies the wrong day into the wrong week.
    effect(() => {
      this.sourceWorkout();
      this.targetWeeks.set([]);
      this.targetDay.set(null);
    });

    // Choosing a second week withdraws the day question, so the pending
    // answer must go with it or it would be submitted invisibly.
    effect(() => {
      if (this.targetWeeks().length !== 1 && this.targetDay() !== null) {
        this.targetDay.set(null);
      }
    });
  }

  setTargetDay(day: number): void {
    this.targetDay.set(day === this.sourceDay() ? null : day);
  }

  cancel(): void {
    this.visible.set(false);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const weeks = [...this.targetWeeks()].sort((a, b) => a - b);
    const toDayIndex = this.canChooseDay() ? (this.targetDay() ?? undefined) : undefined;
    this.visible.set(false);
    this.chosen.emit({ weeks, toDayIndex });
  }
}
