import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import type { RecurrenceRule } from 'core';

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
  imports: [CommonModule, FormsModule, InputNumberModule, DatePickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurrence-builder.html',
  styleUrl: './recurrence-builder.scss',
})
export class RecurrenceBuilder {
  readonly rule = model.required<RecurrenceRule>();
  // `firstStartAt` is only read lazily inside the methods that need it
  // — avoid `new Date()` as a class-field default because it snapshots
  // the time at class instantiation and leaks `Date.now()` into tests.
  readonly firstStartAt = input<string | null>(null);

  protected readonly frequencies = [
    { value: 'DAILY' as const, label: 'Daily' },
    { value: 'WEEKLY' as const, label: 'Weekly' },
    { value: 'MONTHLY' as const, label: 'Monthly' },
  ];
  // Mon-first ISO 8601: 1..7
  protected readonly dayLabels = [
    { iso: 1, short: 'M' },
    { iso: 2, short: 'T' },
    { iso: 3, short: 'W' },
    { iso: 4, short: 'T' },
    { iso: 5, short: 'F' },
    { iso: 6, short: 'S' },
    { iso: 7, short: 'S' },
  ];

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
    const n = this.intervalValue();
    switch (this.rule().frequency) {
      case 'DAILY': return n === 1 ? 'day' : 'days';
      case 'WEEKLY': return n === 1 ? 'week' : 'weeks';
      case 'MONTHLY': return n === 1 ? 'month' : 'months';
    }
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

  protected plainEnglish(): string {
    const r = this.rule();
    const interval = r.interval > 1 ? `every ${r.interval} ` : 'every ';
    let body = '';
    if (r.frequency === 'DAILY') body = `${interval}${r.interval > 1 ? 'days' : 'day'}`;
    else if (r.frequency === 'MONTHLY') body = `${interval}${r.interval > 1 ? 'months' : 'month'}`;
    else {
      const days = (r.daysOfWeek ?? []).map((iso) => this._dayName(iso)).join(', ');
      body = days ? `${interval}${r.interval > 1 ? 'weeks' : 'week'} on ${days}` : 'weekly';
    }
    let tail = '';
    if (r.endAfterOccurrences) tail = ` · ${r.endAfterOccurrences} occurrences`;
    else if (r.endDate) tail = ` · until ${new Date(r.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (!body) return tail.trim() || 'Custom schedule';
    return body[0].toUpperCase() + body.slice(1) + tail;
  }

  private _dayName(iso: number): string {
    return ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][iso] ?? '';
  }

  // Emit only — the parent owns the `rule` model and receives the next
  // value via two-way binding. We set the model signal rather than
  // mutating the previous object so OnPush change-detection sees a new
  // reference.
  private _emit(next: RecurrenceRule): void {
    this.rule.set(next);
  }
}
