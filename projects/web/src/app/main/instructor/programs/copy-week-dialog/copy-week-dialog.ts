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
import { Select } from 'primeng/select';

import { Program } from 'core';

/**
 * "Copy week…" picker for the program builder.
 *
 * Pick a target week for the source week's workouts. The parent owns
 * the API call and the optimistic state; this dialog only resolves the
 * choice and emits it. Anything already in the target week is replaced
 * by the BE, so the target-week option surfaces the count of workouts
 * that would be overwritten and the primary CTA reads "Replace week N"
 * rather than a bare "Copy" whenever the target is non-empty.
 */
@Component({
  selector: 'mh-copy-week-dialog',
  imports: [FormsModule, ButtonDirective, Dialog, Select],
  templateUrl: './copy-week-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyWeekDialog {
  readonly program = input.required<Program>();
  /** 0-based source week — the one whose content will be copied. */
  readonly sourceWeekIndex = input.required<number>();
  readonly visible = model<boolean>(false);
  /** Emits the 0-based target week — parent performs the copy. */
  readonly chosen = output<number>();

  readonly targetWeek = signal<number>(0);

  readonly weekOptions = computed<SelectItem<number>[]>(() => {
    const days = this.program().durationDays ?? 84; // 12 weeks default
    const totalWeeks = Math.max(1, Math.ceil(days / 7));
    const source = this.sourceWeekIndex();
    const workoutsByWeek = new Map<number, number>();
    for (const w of this.program().workouts ?? []) {
      workoutsByWeek.set(w.weekIndex, (workoutsByWeek.get(w.weekIndex) ?? 0) + 1);
    }
    return Array.from({ length: totalWeeks }, (_, i) => {
      const count = workoutsByWeek.get(i) ?? 0;
      const suffix =
        count === 0
          ? ' (empty)'
          : count === 1
            ? ' · 1 workout will be replaced'
            : ` · ${count} workouts will be replaced`;
      return {
        value: i,
        label: `Week ${i + 1}${suffix}`,
        disabled: i === source,
      };
    });
  });

  readonly targetOccupancy = computed(() => {
    const t = this.targetWeek();
    return (this.program().workouts ?? []).filter((w) => w.weekIndex === t).length;
  });

  readonly submitLabel = computed(() =>
    this.targetOccupancy() > 0 ? `Replace week ${this.targetWeek() + 1}` : 'Copy',
  );

  readonly canSubmit = computed(
    () => this.targetWeek() !== this.sourceWeekIndex(),
  );

  constructor() {
    // Preselect the week after the source — 95% of the time the coach
    // wants "same thing next week" and this puts them one click away.
    effect(() => {
      if (this.visible()) {
        const source = this.sourceWeekIndex();
        const totalWeeks = this.weekOptions().length;
        const next = source + 1 < totalWeeks ? source + 1 : Math.max(0, source - 1);
        this.targetWeek.set(next);
      }
    });
  }

  cancel(): void {
    this.visible.set(false);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.chosen.emit(this.targetWeek());
    this.visible.set(false);
  }
}
