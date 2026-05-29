import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import type { RecurrenceRule } from '../../models/session/session.model';

/**
 * `mh-recurrence-builder` — interactive editor for `RecurrenceRule`.
 *
 * Drives the create/edit dialog's recurrence section. Reusable for any
 * future recurring concept (workouts, meal plans, reminders).
 *
 * Inputs / Outputs:
 *   - `[(rule)]` two-way binding via `rule` + `ruleChange`
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
  standalone: true,
  imports: [CommonModule, FormsModule, InputNumberModule, DatePickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-rec">
      <!-- Frequency -->
      <div class="mh-rec__row">
        <span class="mh-rec__label">Repeats</span>
        <div class="mh-rec__chips">
          @for (f of frequencies; track f.value) {
            <button
              type="button"
              class="mh-rec__chip"
              [class.is-active]="rule.frequency === f.value"
              (click)="setFrequency(f.value)"
            >
              {{ f.label }}
            </button>
          }
        </div>
      </div>

      <!-- Interval -->
      <div class="mh-rec__row">
        <span class="mh-rec__label">Every</span>
        <p-inputNumber
          [(ngModel)]="intervalSig"
          (ngModelChange)="setInterval($event)"
          [min]="1"
          [max]="99"
          [showButtons]="true"
          inputStyleClass="mh-rec__num"
        />
        <span class="mh-rec__hint">{{ periodLabel() }}</span>
      </div>

      <!-- Days of week (WEEKLY only) -->
      @if (rule.frequency === 'WEEKLY') {
        <div class="mh-rec__row">
          <span class="mh-rec__label">On</span>
          <div class="mh-rec__dows" role="group" aria-label="Days of week">
            @for (d of dayLabels; track d.iso) {
              <button
                type="button"
                class="mh-rec__dow"
                [class.is-active]="isDowSelected(d.iso)"
                (click)="toggleDow(d.iso)"
                [attr.aria-pressed]="isDowSelected(d.iso)"
              >
                {{ d.short }}
              </button>
            }
          </div>
        </div>
      }

      <!-- End conditions -->
      <div class="mh-rec__row mh-rec__row--end">
        <span class="mh-rec__label">Ends</span>
        <div class="mh-rec__seg" role="radiogroup">
          <button
            type="button"
            class="mh-rec__seg-btn"
            [class.is-active]="endMode() === 'never'"
            (click)="setEndMode('never')"
          >Never</button>
          <button
            type="button"
            class="mh-rec__seg-btn"
            [class.is-active]="endMode() === 'date'"
            (click)="setEndMode('date')"
          >On date</button>
          <button
            type="button"
            class="mh-rec__seg-btn"
            [class.is-active]="endMode() === 'count'"
            (click)="setEndMode('count')"
          >After N times</button>
        </div>
        @if (endMode() === 'date') {
          <p-datepicker
            [(ngModel)]="endDateSig"
            (ngModelChange)="setEndDate($event)"
            dateFormat="dd M yy"
            [appendTo]="'body'"
            placeholder="Pick a date"
          />
        }
        @if (endMode() === 'count') {
          <p-inputNumber
            [(ngModel)]="endCountSig"
            (ngModelChange)="setEndCount($event)"
            [min]="1"
            [max]="24"
            [showButtons]="true"
            inputStyleClass="mh-rec__num"
          />
          <span class="mh-rec__hint">occurrences (max 24)</span>
        }
      </div>

      <!-- Plain English -->
      <div class="mh-rec__summary">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
        <span>{{ plainEnglish() }}</span>
      </div>
    </div>
  `,
  styles: `
    .mh-rec {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px 16px;
      background: color-mix(in srgb, var(--p-text-color) 4%, transparent);
      border-radius: 12px;
      border: 1px solid var(--p-content-border-color);
    }
    .mh-rec__row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mh-rec__row--end {
      align-items: center;
    }
    .mh-rec__label {
      font-size: 13px;
      font-weight: 600;
      color: var(--p-text-color);
      min-width: 64px;
    }
    .mh-rec__chips {
      display: inline-flex;
      gap: 4px;
      background: var(--p-content-background);
      padding: 2px;
      border-radius: 8px;
      border: 1px solid var(--p-content-border-color);
    }
    .mh-rec__chip {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: var(--p-text-muted-color);
    }
    .mh-rec__chip.is-active {
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color, #fff);
    }
    .mh-rec__hint { font-size: 12px; color: var(--p-text-muted-color); }
    /* Widen the input itself + give the p-inputNumber wrapper a
       minimum width so the stepper buttons don't squeeze the digit
       out of view. Default 64px input + default PrimeNG stepper
       padding meant a 2-digit value rendered as an apostrophe-wide
       column. */
    :host ::ng-deep .mh-rec__num {
      width: 72px;
      text-align: center;
      padding-left: 8px;
      padding-right: 8px;
    }
    :host ::ng-deep p-inputNumber {
      display: inline-flex;
      min-width: 120px;
    }
    :host ::ng-deep p-inputNumber .p-inputnumber {
      width: 100%;
    }
    .mh-rec__dows {
      display: inline-flex;
      gap: 4px;
    }
    .mh-rec__dow {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--p-content-border-color);
      background: transparent;
      font-size: 11px;
      font-weight: 700;
      color: var(--p-text-muted-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mh-rec__dow.is-active {
      background: var(--p-primary-500);
      border-color: var(--p-primary-500);
      color: var(--p-primary-contrast-color, #fff);
    }
    .mh-rec__seg {
      display: inline-flex;
      background: var(--p-content-background);
      padding: 2px;
      border-radius: 8px;
      border: 1px solid var(--p-content-border-color);
    }
    .mh-rec__seg-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: var(--p-text-muted-color);
    }
    .mh-rec__seg-btn.is-active {
      background: var(--p-primary-50);
      color: var(--p-primary-800);
    }
    .mh-rec__summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--p-primary-50);
      color: var(--p-primary-800);
      border-radius: 8px;
      font-size: 13px;
      font-style: italic;
    }
  `,
})
export class RecurrenceBuilder implements OnChanges {
  @Input({ required: true }) rule!: RecurrenceRule;
  // `firstStartAt` is only read lazily inside the methods that need it
  // — avoid `new Date()` as a class-field default because it snapshots
  // the time at class instantiation and leaks `Date.now()` into tests.
  @Input() firstStartAt: string | null = null;
  @Output() ruleChange = new EventEmitter<RecurrenceRule>();

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

  // Local signals for inputs (ngModel-binding intermediates).
  protected intervalSig = 1;
  protected endCountSig: number | null = null;
  protected endDateSig: Date | null = null;

  // End-mode is derived from rule, but kept as a UI signal so segments
  // don't flip when rule changes mid-edit.
  protected readonly endMode = computed(() => {
    if (this.rule.endAfterOccurrences != null) return 'count' as const;
    if (this.rule.endDate) return 'date' as const;
    return 'never' as const;
  });

  ngOnChanges(): void {
    this.intervalSig = this.rule.interval;
    this.endCountSig = this.rule.endAfterOccurrences ?? null;
    this.endDateSig = this.rule.endDate ? new Date(this.rule.endDate) : null;
  }

  protected periodLabel(): string {
    const n = this.intervalSig;
    switch (this.rule.frequency) {
      case 'DAILY': return n === 1 ? 'day' : 'days';
      case 'WEEKLY': return n === 1 ? 'week' : 'weeks';
      case 'MONTHLY': return n === 1 ? 'month' : 'months';
    }
  }

  protected isDowSelected(iso: number): boolean {
    return (this.rule.daysOfWeek ?? []).includes(iso);
  }

  protected setFrequency(f: 'DAILY' | 'WEEKLY' | 'MONTHLY'): void {
    const next: RecurrenceRule = { ...this.rule, frequency: f };
    if (f !== 'WEEKLY') delete next.daysOfWeek;
    else if (!next.daysOfWeek?.length) {
      // Default to the day-of-week of `firstStartAt` (or today if the
      // parent didn't supply one).
      const d = this.firstStartAt ? new Date(this.firstStartAt) : new Date();
      const iso = ((d.getDay() + 6) % 7) + 1;
      next.daysOfWeek = [iso];
    }
    this._emit(next);
  }

  protected setInterval(n: number | null): void {
    if (n == null || n < 1) return;
    this._emit({ ...this.rule, interval: n });
  }

  protected toggleDow(iso: number): void {
    const set = new Set(this.rule.daysOfWeek ?? []);
    if (set.has(iso)) set.delete(iso);
    else set.add(iso);
    if (set.size === 0) return; // refuse empty
    this._emit({
      ...this.rule,
      daysOfWeek: Array.from(set).sort((a, b) => a - b),
    });
  }

  protected setEndMode(mode: 'never' | 'date' | 'count'): void {
    const next: RecurrenceRule = { ...this.rule };
    delete next.endAfterOccurrences;
    delete next.endDate;
    if (mode === 'count') next.endAfterOccurrences = this.endCountSig ?? 12;
    if (mode === 'date') {
      const d = this.endDateSig ?? new Date(Date.now() + 30 * 86_400_000);
      next.endDate = d.toISOString().slice(0, 10);
    }
    this._emit(next);
  }

  protected setEndDate(d: Date): void {
    if (!d) return;
    this._emit({
      ...this.rule,
      endDate: d.toISOString().slice(0, 10),
      endAfterOccurrences: undefined,
    });
  }

  protected setEndCount(n: number | null): void {
    if (n == null) return;
    this._emit({
      ...this.rule,
      endAfterOccurrences: n,
      endDate: undefined,
    });
  }

  protected plainEnglish(): string {
    const r = this.rule;
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

  // Emit only — the parent owns the `rule` input and will pass the next
  // value back via two-way binding. Mutating `this.rule` here would race
  // with OnPush change-detection.
  private _emit(next: RecurrenceRule): void {
    this.ruleChange.emit(next);
  }
}
