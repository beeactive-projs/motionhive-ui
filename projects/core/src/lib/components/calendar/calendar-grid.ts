import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import type {
  CalendarCellClick,
  CalendarCellDrag,
  CalendarEvent,
  CalendarRange,
  CalendarVariant,
  CalendarView,
} from './calendar-event.model';
import { EventBlock } from './event-block';

/** Domain-agnostic calendar grid — consumers map their entities to
 *  `CalendarEvent` and wire the outputs. Imports nothing from `models/session/*`. */
@Component({
  selector: 'mh-calendar-grid',
  standalone: true,
  imports: [CommonModule, EventBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-grid.html',
  styleUrl: './calendar-grid.scss',
})
export class CalendarGrid {
  // Signal inputs so `days()`/`hours()` track them as deps (OnPush requirement).
  readonly view = input<CalendarView>('week');
  readonly variant = input<CalendarVariant>('standard');
  readonly dateRange = input.required<CalendarRange>();
  readonly events = input<CalendarEvent[]>([]);
  readonly timezone = input<string>('Europe/Bucharest');
  readonly hourRange = input<[number, number]>([6, 21]);
  readonly rowHeightPx = input<number>(44);
  readonly nowLine = input<boolean>(true);
  readonly showOverflow = input<boolean>(true);
  readonly loading = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly selectedDate = input<Date | null>(null);

  // ─── Outputs ───────────────────────────────────────────────────────

  @Output() cellClick = new EventEmitter<CalendarCellClick>();
  @Output() cellDrag = new EventEmitter<CalendarCellDrag>();
  @Output() eventClick = new EventEmitter<CalendarEvent>();
  @Output() rangeChange = new EventEmitter<CalendarRange>();
  /**
   * Fired when the user clicks the "+N more" pill on a day with more
   * concurrent events than `MAX_LANES`. The smart wrapper typically
   * responds by switching to the Day view focused on that date.
   */
  @Output() overflowClick = new EventEmitter<Date>();

  // ─── Internal state ────────────────────────────────────────────────

  private readonly _destroy = inject(DestroyRef);
  private readonly _now = signal(new Date());

  /** Drag-tracking state — exposed for the template. */
  protected readonly _dragState = signal<null | {
    dayIndex: number;
    startHour: number;
    endHour: number;
    shiftKey: boolean;
    /** Last-known pointer coords (updated on move; used by popover positioning). */
    clientX: number;
    clientY: number;
  }>(null);

  constructor() {
    // Tick `_now` once a minute so the now-line follows real time. The
    // grid template reads `_now()` and derives a `top` offset.
    interval(60_000)
      .pipe(takeUntilDestroyed(this._destroy))
      .subscribe(() => this._now.set(new Date()));
  }

  // ─── Derived state ─────────────────────────────────────────────────

  /** Total hour rows shown in the body. */
  protected readonly hours = computed(() => {
    const [from, to] = this.hourRange();
    const out: number[] = [];
    for (let h = from; h <= to; h++) out.push(h);
    return out;
  });

  /** Day columns for week view. */
  protected readonly days = computed(() => {
    if (this.view() !== 'week') return [];
    const start = new Date(this.dateRange().start);
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  });

  /** Now-line offset in pixels from the top of the body, for today only. */
  protected readonly nowOffsetPx = computed(() => {
    if (!this.nowLine()) return null;
    const now = this._now();
    const [from, to] = this.hourRange();
    const hoursFromTop = now.getHours() + now.getMinutes() / 60 - from;
    if (hoursFromTop < 0 || hoursFromTop > to - from) return null;
    return hoursFromTop * this.rowHeightPx();
  });

  /** Total body height in pixels. */
  protected readonly bodyHeightPx = computed(() => {
    const [from, to] = this.hourRange();
    return (to - from + 1) * this.rowHeightPx();
  });

  /** "HH:mm" label for the now-line tooltip + pill. */
  protected readonly nowTimeLabel = computed(() =>
    this._now().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  // ─── Event positioning ─────────────────────────────────────────────

  /**
   * Cap on how many concurrent-event lanes a column will split into.
   * Beyond this, additional events are collapsed into a "+N more" indicator
   * so each card stays readable. 2 keeps each card at ~50% of the column
   * width — enough for ~8-10 chars of title at typical week-view widths.
   */
  private static readonly MAX_LANES = 2;

  /**
   * For a given event, compute its `top` + `height` in pixels plus
   * `leftPct` / `widthPct` to split the column among overlapping events.
   * Events assigned a lane >= MAX_LANES are hidden (handled by `eventsForDay`
   * filtering out the overflow set; this method only sees visible ones).
   */
  protected eventLayout(event: CalendarEvent): {
    top: number;
    height: number;
    leftPct: number;
    widthPct: number;
  } {
    const [from] = this.hourRange();
    const rowHeight = this.rowHeightPx();
    const startH = event.start.getHours() + event.start.getMinutes() / 60;
    const endH = event.end.getHours() + event.end.getMinutes() / 60;
    const layout = this._dayLayouts.get(this._dayKey(event.start));
    const laneIndex = layout?.lanes.get(event.id) ?? 0;
    const visibleLanes = Math.min(
      layout?.totalLanes ?? 1,
      CalendarGrid.MAX_LANES,
    );
    const widthPct = 100 / visibleLanes;
    return {
      top: Math.max(0, (startH - from) * rowHeight),
      height: Math.max(rowHeight / 2, (endH - startH) * rowHeight),
      leftPct: laneIndex * widthPct,
      widthPct,
    };
  }

  protected eventsForDay(day: Date): CalendarEvent[] {
    const events = this.events().filter(
      (e) =>
        e.start.getFullYear() === day.getFullYear() &&
        e.start.getMonth() === day.getMonth() &&
        e.start.getDate() === day.getDate(),
    );
    this._computeDayLanes(day, events);
    const layout = this._dayLayouts.get(this._dayKey(day));
    if (!layout) return events;
    return events.filter(
      (e) => (layout.lanes.get(e.id) ?? 0) < CalendarGrid.MAX_LANES,
    );
  }

  /** Count of events in this day that got dropped because all lanes were full. */
  protected overflowCountFor(day: Date): number {
    const layout = this._dayLayouts.get(this._dayKey(day));
    if (!layout) return 0;
    let n = 0;
    for (const lane of layout.lanes.values()) {
      if (lane >= CalendarGrid.MAX_LANES) n++;
    }
    return n;
  }

  // Side-effect of `eventsForDay` — kept here (not a `computed()`) so the
  // template's `eventLayout()` + `overflowCountFor()` can read it back per day.
  private readonly _dayLayouts = new Map<
    string,
    { lanes: Map<string, number>; totalLanes: number }
  >();

  /** Local-zone YYYY-MM-DD — toISOString would UTC-shift across midnight. */
  private _dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Greedy interval scheduling. Sort start ASC + end DESC so longer
  // concurrent events take the leftmost lanes (otherwise short events
  // would visually occlude long ones sharing the same start).
  private _computeDayLanes(day: Date, events: CalendarEvent[]): void {
    const sorted = [...events].sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        b.end.getTime() - a.end.getTime(),
    );
    const laneEndTimes: number[] = [];
    const lanes = new Map<string, number>();
    for (const e of sorted) {
      const startMs = e.start.getTime();
      let lane = laneEndTimes.findIndex((endMs) => endMs <= startMs);
      if (lane === -1) {
        laneEndTimes.push(e.end.getTime());
        lane = laneEndTimes.length - 1;
      } else {
        laneEndTimes[lane] = e.end.getTime();
      }
      lanes.set(e.id, lane);
    }
    this._dayLayouts.set(this._dayKey(day), {
      lanes,
      totalLanes: Math.max(1, laneEndTimes.length),
    });
  }

  // Drag may run upward — template needs canonical [min,max] for rendering.
  protected dragMinHour = (drag: { startHour: number; endHour: number }) =>
    Math.min(drag.startHour, drag.endHour);
  protected dragMaxHour = (drag: { startHour: number; endHour: number }) =>
    Math.max(drag.startHour, drag.endHour);

  /** Is the given day today? */
  protected isToday(day: Date): boolean {
    const today = this._now();
    return (
      day.getFullYear() === today.getFullYear() &&
      day.getMonth() === today.getMonth() &&
      day.getDate() === today.getDate()
    );
  }

  /** Is the given day the user-selected one (mini-month anchor)? */
  protected isSelected(day: Date): boolean {
    const sel = this.selectedDate();
    if (!sel) return false;
    return (
      day.getFullYear() === sel.getFullYear() &&
      day.getMonth() === sel.getMonth() &&
      day.getDate() === sel.getDate()
    );
  }

  // ─── Event handlers ────────────────────────────────────────────────

  /** Click on an empty hour-row cell (week or day view). */
  protected onCellClick(day: Date, hour: number, e: MouseEvent): void {
    if (this.readonly()) return;
    e.preventDefault();
    const date = new Date(day);
    date.setHours(hour, 0, 0, 0);
    this.cellClick.emit({ date, hour });
  }

  /** Pointer-down on a cell starts a drag selection. */
  protected onCellPointerDown(
    dayIndex: number,
    hour: number,
    e: PointerEvent,
  ): void {
    if (this.readonly()) return;
    e.preventDefault();
    // Capture the pointer so move/up events keep firing even if the
    // cursor leaves the cell mid-drag. Without this, dragging outside
    // the calendar would strand the drag state.
    (e.target as Element).setPointerCapture(e.pointerId);
    this._dragState.set({
      dayIndex,
      startHour: hour,
      endHour: hour + 1,
      shiftKey: e.shiftKey,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  /** Pointer-move while dragging extends the selection. */
  protected onCellPointerMove(hour: number, e: PointerEvent): void {
    const drag = this._dragState();
    if (!drag) return;
    this._dragState.set({
      ...drag,
      endHour: hour + 1,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  /** Pointer-up commits the drag (or emits a click for single-cell drags). */
  protected onCellPointerUp(): void {
    const drag = this._dragState();
    if (!drag) return;
    const days = this.days();
    const day = days[drag.dayIndex];
    if (!day) {
      this._dragState.set(null);
      return;
    }
    const minHour = Math.min(drag.startHour, drag.endHour);
    const maxHour = Math.max(drag.startHour, drag.endHour);
    const start = new Date(day);
    start.setHours(minHour, 0, 0, 0);
    const end = new Date(day);
    end.setHours(maxHour, 0, 0, 0);
    if (end.getTime() > start.getTime()) {
      this.cellDrag.emit({
        start,
        end,
        shiftKey: drag.shiftKey,
        clientX: drag.clientX,
        clientY: drag.clientY,
      });
    }
    this._dragState.set(null);
  }

  /** Click on a rendered event block. */
  protected onEventClick(event: CalendarEvent, e: MouseEvent): void {
    e.stopPropagation();
    this.eventClick.emit(event);
  }

  /** "+N more" pill — bubble the day up to the smart wrapper. */
  protected onOverflowClick(day: Date, e: MouseEvent): void {
    e.stopPropagation();
    this.overflowClick.emit(day);
  }
}
