import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { appLocale, weekdayNames } from 'core';
import type { RecurrenceRule } from 'core';

const SUMMARY_KEY = 'components.recurrenceBuilder.summary';

/**
 * `mh-recurrence-builder` — interactive editor for `RecurrenceRule`.
 *
 * Drives the create/edit dialog's recurrence section. Reusable for any
 * future recurring concept (workouts, meal plans, reminders).
 *
 * Inputs / Outputs:
 *   - `[(rule)]` two-way binding via `rule`
 *   - `firstStartAt` — anchors the "every Monday & Wednesday" copy
 *
 * UI per design canvas `i-create-rec`:
 *   1. Frequency chips — Daily / Weekly / Monthly
 *   2. Interval stepper — "every N {periods}"
 *   3. Day-of-week picker — Mon–Sun circles (WEEKLY only). 1=Mon..7=Sun ISO.
 *   4. End-conditions segmented — Never / On date / After N times
 *   5. Plain-English summary
 */
@Component({
  selector: 'mh-recurrence-builder',
  imports: [CommonModule, FormsModule, InputNumberModule, DatePickerModule, TranslatePipe],
  templateUrl: './recurrence-builder.html',
  styleUrl: './recurrence-builder.scss',
})
export class RecurrenceBuilder {
  private readonly _translateService = inject(TranslateService);

  readonly rule = model.required<RecurrenceRule>();
  // `firstStartAt` is only read lazily inside the methods that need it
  // — avoid `new Date()` as a class-field default because it snapshots
  // the time at class instantiation and leaks `Date.now()` into tests.
  readonly firstStartAt = input<string | null>(null);

  /** Labels are translation keys — the template translates them. */
  protected readonly frequencies = [
    { value: 'DAILY' as const, label: 'components.recurrenceBuilder.frequency.DAILY' },
    { value: 'WEEKLY' as const, label: 'components.recurrenceBuilder.frequency.WEEKLY' },
    { value: 'MONTHLY' as const, label: 'components.recurrenceBuilder.frequency.MONTHLY' },
  ];
  // Mon-first ISO 8601: 1..7, named in the UI locale.
  private readonly _shortDayNames = weekdayNames('short');
  private readonly _longDayNames = weekdayNames('long');
  protected readonly dayLabels = weekdayNames('narrow').map((short, i) => ({
    iso: i + 1,
    short,
    long: this._longDayNames[i],
  }));

  // Local writable signals for inputs (ngModel-binding intermediates).
  protected readonly intervalValue = signal(1);
  protected readonly endCountValue = signal<number | null>(null);
  protected readonly endDateValue = signal<Date | null>(null);

  // End-mode is derived from rule, but kept as a UI signal so segments
  // don't flip when rule changes mid-edit.
  protected readonly endMode = computed(() => {
    const r = this.rule();
    if (r.endAfterOccurrences != null) return 'count' as const;
    if (r.endDate) return 'date' as const;
    return 'never' as const;
  });

  constructor() {
    // Sync the ngModel intermediates whenever the bound rule changes
    // (replaces the former `ngOnChanges`).
    effect(() => {
      const r = this.rule();
      this.intervalValue.set(r.interval);
      this.endCountValue.set(r.endAfterOccurrences ?? null);
      this.endDateValue.set(r.endDate ? new Date(r.endDate) : null);
    });
  }

  protected periodLabel(): string {
    return this._translateService.instant(
      `components.recurrenceBuilder.period.${this.rule().frequency}`,
      { count: this.intervalValue() },
    );
  }

  protected isDowSelected(iso: number): boolean {
    return (this.rule().daysOfWeek ?? []).includes(iso);
  }

  protected setFrequency(f: 'DAILY' | 'WEEKLY' | 'MONTHLY'): void {
    const next: RecurrenceRule = { ...this.rule(), frequency: f };
    if (f !== 'WEEKLY') delete next.daysOfWeek;
    else if (!next.daysOfWeek?.length) {
      // Default to the day-of-week of `firstStartAt` (or today if the
      // parent didn't supply one).
      const d = this.firstStartAt() ? new Date(this.firstStartAt()!) : new Date();
      const iso = ((d.getDay() + 6) % 7) + 1;
      next.daysOfWeek = [iso];
    }
    this._emit(next);
  }

  protected setInterval(n: number | null): void {
    if (n == null || n < 1) return;
    this._emit({ ...this.rule(), interval: n });
  }

  protected toggleDow(iso: number): void {
    const set = new Set(this.rule().daysOfWeek ?? []);
    if (set.has(iso)) set.delete(iso);
    else set.add(iso);
    if (set.size === 0) return; // refuse empty
    this._emit({
      ...this.rule(),
      daysOfWeek: Array.from(set).sort((a, b) => a - b),
    });
  }

  protected setEndMode(mode: 'never' | 'date' | 'count'): void {
    const next: RecurrenceRule = { ...this.rule() };
    delete next.endAfterOccurrences;
    delete next.endDate;
    if (mode === 'count') next.endAfterOccurrences = this.endCountValue() ?? 12;
    if (mode === 'date') {
      const d = this.endDateValue() ?? new Date(Date.now() + 30 * 86_400_000);
      next.endDate = d.toISOString().slice(0, 10);
    }
    this._emit(next);
  }

  protected setEndDate(d: Date): void {
    if (!d) return;
    this._emit({
      ...this.rule(),
      endDate: d.toISOString().slice(0, 10),
      endAfterOccurrences: undefined,
    });
  }

  protected setEndCount(n: number | null): void {
    if (n == null) return;
    this._emit({
      ...this.rule(),
      endAfterOccurrences: n,
      endDate: undefined,
    });
  }

  /** Human summary of the rule, e.g. "Every 2 weeks on Mon, Wed · 12 occurrences". */
  protected plainEnglish(): string {
    const r = this.rule();
    let rule: string;
    if (r.frequency === 'WEEKLY') {
      const days = (r.daysOfWeek ?? [])
        .map((iso) => this._shortDayNames[iso - 1] ?? '')
        .filter(Boolean)
        .join(', ');
      rule = days
        ? this._translateService.instant(`${SUMMARY_KEY}.WEEKLY`, { interval: r.interval, days })
        : this._translateService.instant(`${SUMMARY_KEY}.weeklyNoDays`);
    } else {
      rule = this._translateService.instant(`${SUMMARY_KEY}.${r.frequency}`, {
        interval: r.interval,
      });
    }
    if (r.endAfterOccurrences) {
      return this._translateService.instant(`${SUMMARY_KEY}.withCount`, {
        rule,
        count: r.endAfterOccurrences,
      });
    }
    if (r.endDate) {
      const date = new Date(r.endDate).toLocaleDateString(appLocale(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return this._translateService.instant(`${SUMMARY_KEY}.withEndDate`, { rule, date });
    }
    return rule;
  }

  // Emit only — the parent owns the `rule` model and receives the next
  // value via two-way binding. We set the model signal rather than
  // mutating the previous object so OnPush change-detection sees a new
  // reference.
  private _emit(next: RecurrenceRule): void {
    this.rule.set(next);
  }
}
