import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { sameDay, startOfDay } from '../../utils/date.utils';

/** Small month calendar for navigation — date in, date out. */
@Component({
  selector: 'mh-mini-month',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-mm">
      <header class="mh-mm__header">
        <button
          type="button"
          class="mh-mm__nav"
          (click)="prev()"
          aria-label="Previous month"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="mh-mm__title">
          {{ viewMonth() | date: 'MMMM yyyy' : '' : 'en-GB' }}
        </span>
        <button
          type="button"
          class="mh-mm__nav"
          (click)="next()"
          aria-label="Next month"
        >
          <i class="pi pi-chevron-right" aria-hidden="true"></i>
        </button>
      </header>

      <div class="mh-mm__weekdays" aria-hidden="true">
        <!-- Track by index, not the label — Tue/Thu both render "T" and
             Sat/Sun both "S" → tracking by value would dupe-key (NG0955). -->
        @for (d of weekdayLabels; track $index) {
          <span>{{ d }}</span>
        }
      </div>

      <div class="mh-mm__grid" role="grid">
        @for (day of days(); track day.iso) {
          <button
            type="button"
            class="mh-mm__day"
            [class.is-other-month]="day.otherMonth"
            [class.is-today]="day.isToday"
            [class.is-selected]="day.isSelected"
            [class.is-in-range]="day.isInRange"
            [class.is-range-start]="day.isRangeStart"
            [class.is-range-end]="day.isRangeEnd"
            [attr.aria-current]="day.isToday ? 'date' : null"
            (mousedown)="$event.preventDefault()"
            (click)="select(day.date)"
          >
            {{ day.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .mh-mm {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 12px;
    }
    .mh-mm__header {
      display: grid;
      grid-template-columns: 28px 1fr 28px;
      align-items: center;
    }
    .mh-mm__title {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: var(--p-text-color);
    }
    .mh-mm__nav {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--p-text-muted-color);
      cursor: pointer;
      &:hover { background: var(--p-surface-100); }
    }
    .mh-mm__weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
      text-align: center;
    }
    .mh-mm__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .mh-mm__day {
      aspect-ratio: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--p-text-color);
      cursor: pointer;
      transition: background 120ms ease;
      outline: none;
      position: relative;
      &:hover { background: var(--p-primary-50); }
      /* Only show the focus ring for keyboard nav, not mouse clicks
         (otherwise a leftover ring competes with is-today/is-selected
         and looks like a third selection state). */
      &:focus-visible {
        outline: 2px solid var(--p-primary-500);
        outline-offset: 1px;
      }
      &.is-other-month { color: var(--p-text-muted-color); }
      /* In-range: connected band across the visible week. Square the
         inner edges so adjacent in-range cells visually merge; the
         range-start / range-end keep the outer corner radius. */
      &.is-in-range {
        background: color-mix(in srgb, var(--p-primary-500) 12%, transparent);
        border-radius: 0;
      }
      &.is-in-range.is-range-start {
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
      }
      &.is-in-range.is-range-end {
        border-top-right-radius: 6px;
        border-bottom-right-radius: 6px;
      }
      &.is-selected {
        background: var(--p-primary-100);
        color: var(--p-primary-800);
        border-radius: 6px;
      }
      /* Today wins visually — bold ring around the filled circle
         instead of a separate background, so today + selected can
         coexist on the same cell without a clash. */
      &.is-today {
        background: var(--p-primary-500);
        color: var(--p-primary-contrast-color, #fff);
        border-radius: 6px;
      }
      &.is-today.is-selected {
        box-shadow: 0 0 0 2px var(--p-primary-200);
      }
    }
  `,
})
export class MiniMonth {
  readonly selectedDate = input<Date>(new Date());
  readonly today = input<Date>(new Date());
  /** Optional inclusive band (eg. the visible calendar week). */
  readonly rangeStart = input<Date | null>(null);
  readonly rangeEnd = input<Date | null>(null);

  readonly selectedDateChange = output<Date>();

  // ISO weekday labels (Mon-first).
  protected readonly weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  /**
   * The month currently DISPLAYED. Decoupled from `selectedDate` after
   * first init — the user can navigate the mini-month (← →) to a
   * different month without changing what's selected. Only re-syncs
   * to `selectedDate` if the new selected date is in a different month
   * than the currently-viewed one (e.g. parent jumps to Today).
   */
  private readonly _viewAnchor = signal<Date>(new Date());

  constructor() {
    // Only realign the displayed month when `selectedDate` crosses into
    // a different month — otherwise the user's manual ←/→ nav wouldn't
    // survive parent re-emits of the same week.
    effect(() => {
      const next = this.selectedDate();
      const cur = this._viewAnchor();
      if (
        next.getFullYear() !== cur.getFullYear() ||
        next.getMonth() !== cur.getMonth()
      ) {
        this._viewAnchor.set(next);
      }
    });
  }

  protected readonly viewMonth = computed(() => this._viewAnchor());

  protected readonly days = computed(() => {
    const anchor = this._viewAnchor();
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // ISO 8601: Monday=1..Sunday=7. JS getDay(): Sun=0..Sat=6.
    // We want first cell to be the Monday of the week containing the 1st.
    const dayOfWeek = (firstOfMonth.getDay() + 6) % 7; // 0=Mon..6=Sun
    const gridStart = new Date(year, month, 1 - dayOfWeek);

    const out: {
      date: Date;
      iso: string;
      label: number;
      otherMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isInRange: boolean;
      isRangeStart: boolean;
      isRangeEnd: boolean;
    }[] = [];
    const today = this.today();
    const selected = this.selectedDate();
    // Normalise range bounds to midnight so the inclusive check works
    // regardless of what time-of-day the parent passed.
    const rsRaw = this.rangeStart();
    const reRaw = this.rangeEnd();
    const rs = rsRaw ? startOfDay(rsRaw) : null;
    const re = reRaw ? startOfDay(reRaw) : null;
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const dKey = startOfDay(d).getTime();
      const inRange =
        rs !== null && re !== null && dKey >= rs.getTime() && dKey <= re.getTime();
      out.push({
        date: d,
        iso: d.toISOString().slice(0, 10),
        label: d.getDate(),
        otherMonth: d.getMonth() !== month,
        isToday: sameDay(d, today),
        isSelected: sameDay(d, selected),
        isInRange: inRange,
        isRangeStart: rs !== null && sameDay(d, rs),
        isRangeEnd: re !== null && sameDay(d, re),
      });
    }
    return out;
  });

  protected prev(): void {
    const a = this._viewAnchor();
    this._viewAnchor.set(new Date(a.getFullYear(), a.getMonth() - 1, 1));
  }

  protected next(): void {
    const a = this._viewAnchor();
    this._viewAnchor.set(new Date(a.getFullYear(), a.getMonth() + 1, 1));
  }

  protected select(date: Date): void {
    this.selectedDateChange.emit(date);
  }
}

