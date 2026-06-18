import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { sameDay, startOfDay } from 'core';

/** Small month calendar for navigation — date in, date out. */
@Component({
  selector: 'mh-mini-month',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mini-month.html',
  styleUrl: './mini-month.scss',
})
export class MiniMonth {
  readonly selectedDate = model<Date>(new Date());
  readonly today = input<Date>(new Date());
  /** Optional inclusive band (eg. the visible calendar week). */
  readonly rangeStart = input<Date | null>(null);
  readonly rangeEnd = input<Date | null>(null);

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
    this.selectedDate.set(date);
  }
}
